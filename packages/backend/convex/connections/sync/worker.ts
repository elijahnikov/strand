"use node";

import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { DataModel, Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { getProvider } from "../providers/registry";
import type {
  ProviderSync,
  ResourceUpsert,
  SyncContext,
} from "../providers/types";
import { decryptToken } from "../tokens";

const providerValidator = v.union(
  v.literal("notion"),
  v.literal("raindrop"),
  v.literal("google_drive"),
  v.literal("readwise"),
  v.literal("github"),
  v.literal("linear")
);

interface PreparedRun {
  connectionId: Id<"connection">;
  ctx: SyncContext;
  providerId:
    | "notion"
    | "raindrop"
    | "google_drive"
    | "readwise"
    | "github"
    | "linear";
  sync: ProviderSync;
  workspaceId: Id<"workspace">;
}

type ActionCtx = GenericActionCtx<DataModel>;

async function prepare(
  ctx: ActionCtx,
  connectionId: Id<"connection">
): Promise<PreparedRun | null> {
  const conn = await ctx.runQuery(
    internal.connections.sync.internals.getActiveConnectionForSync,
    { connectionId }
  );
  if (!conn) {
    return null;
  }
  const descriptor = getProvider(conn.provider);
  if (!descriptor.sync) {
    throw new Error(`Provider ${conn.provider} does not support sync`);
  }
  const accessToken = decryptToken(
    conn.encryptedAccessToken,
    conn.tokenKeyVersion
  );
  return {
    connectionId: conn._id,
    workspaceId: conn.workspaceId,
    providerId: conn.provider,
    sync: descriptor.sync,
    ctx: {
      accessToken,
      scopeSelection: conn.scopeSelection,
      workspaceId: conn.workspaceId,
      connectionId: conn._id,
    },
  };
}

async function applyUpserts(
  ctx: ActionCtx,
  jobId: Id<"syncJob">,
  run: PreparedRun,
  upserts: ResourceUpsert[]
): Promise<{ created: number; updated: number; failed: number }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const upsert of upserts) {
    try {
      const result: "created" | "updated" | "skipped" = await ctx.runMutation(
        internal.connections.sync.internals.upsertSyncedResource,
        {
          connectionId: run.connectionId,
          providerId: run.providerId,
          upsert,
        }
      );
      if (result === "created") {
        created += 1;
      } else if (result === "updated") {
        updated += 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(
        "[sync] upsert failed",
        run.providerId,
        upsert.externalId,
        err
      );
    }
  }
  if (created || updated || failed) {
    await ctx.runMutation(
      internal.connections.sync.internals.updateSyncJobProgress,
      {
        jobId,
        deltaCreated: created,
        deltaUpdated: updated,
        deltaSkipped: 0,
        deltaFailed: failed,
      }
    );
  }
  return { created, updated, failed };
}

export const runDelta = internalAction({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args): Promise<void> => {
    const run = await prepare(ctx, args.connectionId);
    if (!run) {
      return;
    }
    const jobId: Id<"syncJob"> = await ctx.runMutation(
      internal.connections.sync.internals.createSyncJob,
      {
        connectionId: run.connectionId,
        workspaceId: run.workspaceId,
        kind: "delta",
      }
    );

    const cursorResult = await ctx.runQuery(
      internal.connections.sync.internals.getSyncCursor,
      { connectionId: run.connectionId, scopeKey: "delta" }
    );
    const cursor: string | undefined = cursorResult ?? undefined;

    try {
      for await (const batch of run.sync.pollDelta({ ...run.ctx, cursor })) {
        const upserts = batch.items.map((raw) =>
          run.sync.toResource(raw, run.ctx)
        );
        await applyUpserts(ctx, jobId, run, upserts);
        if (batch.cursor) {
          await ctx.runMutation(
            internal.connections.sync.internals.setSyncCursor,
            {
              connectionId: run.connectionId,
              scopeKey: "delta",
              cursor: batch.cursor,
            }
          );
        }
        if (batch.done) {
          break;
        }
      }
      await ctx.runMutation(internal.connections.sync.internals.finishSyncJob, {
        jobId,
        status: "completed",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.connections.sync.internals.finishSyncJob, {
        jobId,
        status: "failed",
        lastError: message,
      });
    }
  },
});

/**
 * Apply a single webhook event (upsert or delete) for one external ID.
 * Called from the webhook HTTP route after dedupe.
 */
export const applyWebhookEvent = internalAction({
  args: {
    connectionId: v.id("connection"),
    provider: providerValidator,
    kind: v.union(v.literal("upsert"), v.literal("delete")),
    externalId: v.string(),
    rawItemJson: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const run = await prepare(ctx, args.connectionId);
    if (!run) {
      return;
    }
    if (args.kind === "delete") {
      await ctx.runMutation(
        internal.connections.sync.internals.tombstoneSyncedResource,
        { connectionId: run.connectionId, externalId: args.externalId }
      );
      return;
    }

    let raw: unknown = args.rawItemJson
      ? JSON.parse(args.rawItemJson)
      : undefined;
    if (!raw) {
      if (!run.sync.fetchOne) {
        throw new Error(
          `Provider ${run.providerId} sent webhook without payload and has no fetchOne`
        );
      }
      raw = await run.sync.fetchOne(run.ctx, args.externalId);
      if (!raw) {
        return;
      }
    }
    const upsert = run.sync.toResource(raw, run.ctx);
    await ctx.runMutation(
      internal.connections.sync.internals.upsertSyncedResource,
      {
        connectionId: run.connectionId,
        providerId: run.providerId,
        upsert,
      }
    );
  },
});

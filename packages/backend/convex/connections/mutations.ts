import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { requirePlan } from "../billing/resolver";
import { protectedMutation } from "../utils";

const SYNC_PLANS = ["pro"] as const;
const WEBHOOK_SECRET_BYTES = 32;

function newWebhookSecret(): string {
  const bytes = new Uint8Array(WEBHOOK_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface GitHubScopeSelection {
  repos?: Array<{ name: string; hookId?: number }>;
  starsEnabled?: boolean;
  starsSnapshot?: string[];
}

function githubRepoNames(scope: unknown): string[] {
  const s = scope as GitHubScopeSelection | undefined;
  return s?.repos?.map((r) => r.name) ?? [];
}

export const disconnect = protectedMutation({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    if (connection.status === "revoked") {
      return;
    }

    if (connection.provider === "github") {
      // Keep the token alive for the cleanup action; mark sync off + status=
      // disconnecting so it can't be used for new sync work. The action zeroes
      // out the token after the GitHub DELETE calls finish.
      await ctx.db.patch(args.connectionId, {
        syncEnabled: false,
        disconnectedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.connections.providers.github_actions.disconnectAndCleanup,
        { connectionId: args.connectionId }
      );
      return;
    }

    await ctx.db.patch(args.connectionId, {
      status: "revoked",
      accessToken: undefined,
      refreshToken: undefined,
      encryptedAccessToken: undefined,
      encryptedRefreshToken: undefined,
      tokenKeyVersion: undefined,
      syncEnabled: false,
      disconnectedAt: Date.now(),
    });
  },
});

/**
 * Pro-only. Turns on continuous sync for a connection: binds it to a workspace,
 * stores scope selection, and seeds the delta cursor at "now" so the first
 * sync run only ingests changes that happen *after* this moment. No backfill
 * of existing content — by design.
 */
export const enableSync = protectedMutation({
  args: {
    connectionId: v.id("connection"),
    workspaceId: v.id("workspace"),
    scopeSelection: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requirePlan(ctx, ctx.user._id, [...SYNC_PLANS], "Continuous sync");

    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    if (connection.status !== "active") {
      throw new ConvexError(`Connection is ${connection.status}`);
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", ctx.user._id)
      )
      .first();
    if (!member) {
      throw new ConvexError("Not a member of this workspace");
    }

    await ctx.db.patch(args.connectionId, {
      workspaceId: args.workspaceId,
      scopeSelection: args.scopeSelection,
      syncEnabled: true,
      webhookSecret: connection.webhookSecret ?? newWebhookSecret(),
      status: "active",
      lastSyncedAt: Date.now(),
    });

    // Seed the delta cursor so the first poll/webhook only sees post-enable
    // edits. Convention: providers store ISO timestamps as cursors.
    const nowIso = new Date().toISOString();
    const existing = await ctx.db
      .query("syncCursor")
      .withIndex("by_connection_scope", (q) =>
        q.eq("connectionId", args.connectionId).eq("scopeKey", "delta")
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cursor: nowIso,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("syncCursor", {
        connectionId: args.connectionId,
        scopeKey: "delta",
        cursor: nowIso,
        updatedAt: Date.now(),
      });
    }

    // GitHub: register webhooks on each picked repo. Action runs async so the
    // mutation returns immediately; user sees the "Sync on" state right away
    // and webhooks come online a few seconds later.
    if (connection.provider === "github") {
      await ctx.scheduler.runAfter(
        0,
        internal.connections.providers.github_actions.reconcileWebhooks,
        {
          connectionId: args.connectionId,
          targetRepos: githubRepoNames(args.scopeSelection),
        }
      );
    }
  },
});

export const setScopeSelection = protectedMutation({
  args: {
    connectionId: v.id("connection"),
    scopeSelection: v.any(),
  },
  handler: async (ctx, args) => {
    await requirePlan(ctx, ctx.user._id, [...SYNC_PLANS], "Continuous sync");
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    await ctx.db.patch(args.connectionId, {
      scopeSelection: args.scopeSelection,
    });
    // Note: changing scope does not retroactively pull existing content; only
    // changes after this point that match the new scope will be synced.

    if (connection.provider === "github") {
      await ctx.scheduler.runAfter(
        0,
        internal.connections.providers.github_actions.reconcileWebhooks,
        {
          connectionId: args.connectionId,
          targetRepos: githubRepoNames(args.scopeSelection),
        }
      );
    }
  },
});

export const setSyncPaused = protectedMutation({
  args: {
    connectionId: v.id("connection"),
    paused: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    if (args.paused) {
      await ctx.db.patch(args.connectionId, {
        status: "paused",
        syncEnabled: false,
      });
    } else {
      await requirePlan(ctx, ctx.user._id, [...SYNC_PLANS], "Continuous sync");
      await ctx.db.patch(args.connectionId, {
        status: "active",
        syncEnabled: true,
      });
    }
  },
});

export const triggerSyncNow = protectedMutation({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    await requirePlan(ctx, ctx.user._id, [...SYNC_PLANS], "Continuous sync");
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    await ctx.scheduler.runAfter(0, internal.connections.sync.worker.runDelta, {
      connectionId: args.connectionId,
    });
  },
});

export const rename = protectedMutation({
  args: {
    connectionId: v.id("connection"),
    providerAccountLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    const trimmed = args.providerAccountLabel.trim();
    if (trimmed.length === 0 || trimmed.length > 120) {
      throw new ConvexError("Label must be 1–120 characters");
    }
    await ctx.db.patch(args.connectionId, {
      providerAccountLabel: trimmed,
    });
  },
});

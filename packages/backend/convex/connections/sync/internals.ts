import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";
import { createResourceForImport } from "../../resource/mutations";

const jobKindValidator = v.union(
  v.literal("backfill"),
  v.literal("delta"),
  v.literal("webhook")
);

const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);

const upsertPayload = v.object({
  externalId: v.string(),
  externalUrl: v.optional(v.string()),
  type: v.union(v.literal("website"), v.literal("note"), v.literal("file")),
  title: v.string(),
  description: v.optional(v.string()),
  note: v.optional(
    v.object({
      htmlContent: v.optional(v.string()),
      jsonContent: v.optional(v.string()),
      plainTextContent: v.optional(v.string()),
    })
  ),
  website: v.optional(
    v.object({
      url: v.string(),
      domain: v.optional(v.string()),
      favicon: v.optional(v.string()),
      ogTitle: v.optional(v.string()),
      ogDescription: v.optional(v.string()),
      ogImage: v.optional(v.string()),
      siteName: v.optional(v.string()),
      articleContent: v.optional(v.string()),
    })
  ),
});

export const createSyncJob = internalMutation({
  args: {
    connectionId: v.id("connection"),
    workspaceId: v.id("workspace"),
    kind: jobKindValidator,
  },
  handler: async (ctx, args): Promise<Id<"syncJob">> => {
    return await ctx.db.insert("syncJob", {
      connectionId: args.connectionId,
      workspaceId: args.workspaceId,
      kind: args.kind,
      status: "running",
      startedAt: Date.now(),
      counts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    });
  },
});

export const updateSyncJobProgress = internalMutation({
  args: {
    jobId: v.id("syncJob"),
    deltaCreated: v.number(),
    deltaUpdated: v.number(),
    deltaSkipped: v.number(),
    deltaFailed: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return;
    }
    await ctx.db.patch(args.jobId, {
      counts: {
        created: job.counts.created + args.deltaCreated,
        updated: job.counts.updated + args.deltaUpdated,
        skipped: job.counts.skipped + args.deltaSkipped,
        failed: job.counts.failed + args.deltaFailed,
      },
      cursor: args.cursor ?? job.cursor,
    });
  },
});

export const finishSyncJob = internalMutation({
  args: {
    jobId: v.id("syncJob"),
    status: jobStatusValidator,
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      finishedAt: Date.now(),
      lastError: args.lastError,
    });
    const job = await ctx.db.get(args.jobId);
    if (job && (args.status === "completed" || args.status === "failed")) {
      await ctx.db.patch(job.connectionId, {
        lastSyncedAt: Date.now(),
        ...(args.status === "failed"
          ? { lastError: args.lastError, lastErrorAt: Date.now() }
          : { lastError: undefined, lastErrorAt: undefined }),
      });
    }
  },
});

export const getSyncCursor = internalQuery({
  args: {
    connectionId: v.id("connection"),
    scopeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("syncCursor")
      .withIndex("by_connection_scope", (q) =>
        q.eq("connectionId", args.connectionId).eq("scopeKey", args.scopeKey)
      )
      .unique();
    return row?.cursor;
  },
});

export const setSyncCursor = internalMutation({
  args: {
    connectionId: v.id("connection"),
    scopeKey: v.string(),
    cursor: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncCursor")
      .withIndex("by_connection_scope", (q) =>
        q.eq("connectionId", args.connectionId).eq("scopeKey", args.scopeKey)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cursor: args.cursor,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("syncCursor", {
      connectionId: args.connectionId,
      scopeKey: args.scopeKey,
      cursor: args.cursor,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Returns true if the event is new and was recorded; false if it's a duplicate.
 * Caller should skip processing on `false`.
 */
export const recordSyncEvent = internalMutation({
  args: {
    connectionId: v.id("connection"),
    providerEventId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("syncEvent")
      .withIndex("by_connection_event", (q) =>
        q
          .eq("connectionId", args.connectionId)
          .eq("providerEventId", args.providerEventId)
      )
      .unique();
    if (existing) {
      return false;
    }
    await ctx.db.insert("syncEvent", {
      connectionId: args.connectionId,
      providerEventId: args.providerEventId,
      receivedAt: Date.now(),
    });
    return true;
  },
});

/**
 * Insert or patch a resource keyed by (sourceConnectionId, sourceExternalId).
 * Returns "created" | "updated" | "skipped".
 */
export const upsertSyncedResource = internalMutation({
  args: {
    connectionId: v.id("connection"),
    providerId: v.string(),
    upsert: upsertPayload,
  },
  handler: async (ctx, args): Promise<"created" | "updated" | "skipped"> => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection?.workspaceId) {
      throw new ConvexError("Connection or workspace not found");
    }

    const existing = await ctx.db
      .query("resource")
      .withIndex("by_source_external", (q) =>
        q
          .eq("sourceConnectionId", args.connectionId)
          .eq("sourceExternalId", args.upsert.externalId)
      )
      .first();

    if (existing) {
      const now = Date.now();
      // Patch base fields; child rows updated separately below.
      await ctx.db.patch(existing._id, {
        title: args.upsert.title,
        description: args.upsert.description,
        sourceExternalUrl: args.upsert.externalUrl,
        updatedAt: now,
        syncedAt: now,
        deletedAt: undefined,
      });
      if (args.upsert.type === "note" && args.upsert.note) {
        // Use db.replace (not patch) so that any stale jsonContent from prior
        // editor snapshots is unambiguously cleared. Sync is authoritative for
        // these resources; in-app edits to synced notes are intentionally
        // overwritten on the next Notion change.
        const child = await ctx.db
          .query("noteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", existing._id))
          .unique();
        if (child) {
          await ctx.db.replace(child._id, {
            resourceId: existing._id,
            htmlContent: args.upsert.note.htmlContent,
            plainTextContent: args.upsert.note.plainTextContent,
          });
        }
        const editorContent = await ctx.db
          .query("resourceContent")
          .withIndex("by_resource", (q) => q.eq("resourceId", existing._id))
          .unique();
        if (editorContent) {
          await ctx.db.replace(editorContent._id, {
            resourceId: existing._id,
            htmlContent: args.upsert.note.htmlContent,
            plainTextContent: args.upsert.note.plainTextContent,
          });
        } else {
          await ctx.db.insert("resourceContent", {
            resourceId: existing._id,
            htmlContent: args.upsert.note.htmlContent,
            plainTextContent: args.upsert.note.plainTextContent,
          });
        }
      } else if (args.upsert.type === "website" && args.upsert.website) {
        const child = await ctx.db
          .query("websiteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", existing._id))
          .unique();
        if (child) {
          await ctx.db.patch(child._id, {
            url: args.upsert.website.url,
            domain: args.upsert.website.domain,
            favicon: args.upsert.website.favicon,
            ogTitle: args.upsert.website.ogTitle,
            ogDescription: args.upsert.website.ogDescription,
            ogImage: args.upsert.website.ogImage,
            siteName: args.upsert.website.siteName,
            articleContent: args.upsert.website.articleContent,
            metadataStatus: "completed",
          });
        }
        if (args.upsert.website.articleContent) {
          const editorContent = await ctx.db
            .query("resourceContent")
            .withIndex("by_resource", (q) => q.eq("resourceId", existing._id))
            .unique();
          if (editorContent) {
            await ctx.db.replace(editorContent._id, {
              resourceId: existing._id,
              htmlContent: args.upsert.website.articleContent,
            });
          } else {
            await ctx.db.insert("resourceContent", {
              resourceId: existing._id,
              htmlContent: args.upsert.website.articleContent,
            });
          }
        }
      }
      return "updated";
    }

    const importedFrom = `${args.providerId}_sync:${args.upsert.externalId}`;
    const resourceId = await createResourceForImport(ctx, {
      workspaceId: connection.workspaceId,
      userId: connection.userId,
      type: args.upsert.type,
      title: args.upsert.title,
      description: args.upsert.description,
      url: args.upsert.website?.url,
      htmlContent:
        args.upsert.note?.htmlContent ?? args.upsert.website?.articleContent,
      jsonContent: args.upsert.note?.jsonContent,
      plainTextContent: args.upsert.note?.plainTextContent,
      collectionId: connection.destinationCollectionId,
      importedFrom,
    });

    await ctx.db.patch(resourceId, {
      sourceConnectionId: args.connectionId,
      sourceProviderId: args.providerId,
      sourceExternalId: args.upsert.externalId,
      sourceExternalUrl: args.upsert.externalUrl,
      syncedAt: Date.now(),
    });

    // Editor renders from resourceContent (separate from the type-specific
    // noteResource/websiteResource child). Seed it so the body shows up.
    if (args.upsert.type === "note" && args.upsert.note) {
      await ctx.db.insert("resourceContent", {
        resourceId,
        htmlContent: args.upsert.note.htmlContent,
        jsonContent: args.upsert.note.jsonContent,
        plainTextContent: args.upsert.note.plainTextContent,
      });
    } else if (args.upsert.type === "website" && args.upsert.website) {
      // Sync provides authoritative metadata directly from the source API
      // (e.g. GitHub issue body, Notion page) — skip the URL scrape that
      // leaves metadataStatus stuck on "pending" for private repos.
      const website = args.upsert.website;
      const child = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .unique();
      if (child) {
        await ctx.db.patch(child._id, {
          domain: website.domain ?? child.domain,
          favicon: website.favicon,
          ogTitle: website.ogTitle,
          ogDescription: website.ogDescription,
          ogImage: website.ogImage,
          siteName: website.siteName,
          articleContent: website.articleContent,
          metadataStatus: "completed",
        });
      }
      if (website.articleContent) {
        await ctx.db.insert("resourceContent", {
          resourceId,
          htmlContent: website.articleContent,
        });
      }
    }
    return "created";
  },
});

export const tombstoneSyncedResource = internalMutation({
  args: {
    connectionId: v.id("connection"),
    externalId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("resource")
      .withIndex("by_source_external", (q) =>
        q
          .eq("sourceConnectionId", args.connectionId)
          .eq("sourceExternalId", args.externalId)
      )
      .first();
    if (!existing || existing.deletedAt) {
      return false;
    }
    await ctx.db.patch(existing._id, { deletedAt: Date.now() });
    return true;
  },
});

export const getActiveConnectionForSync = internalQuery({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      return null;
    }
    if (
      connection.status !== "active" ||
      !(
        connection.encryptedAccessToken &&
        connection.tokenKeyVersion &&
        connection.workspaceId
      )
    ) {
      return null;
    }
    return {
      _id: connection._id,
      provider: connection.provider,
      workspaceId: connection.workspaceId,
      scopeSelection: connection.scopeSelection,
      encryptedAccessToken: connection.encryptedAccessToken,
      tokenKeyVersion: connection.tokenKeyVersion,
      webhookSecret: connection.webhookSecret,
    };
  },
});

/**
 * Look up the active sync-enabled connection for a (provider, providerAccountId)
 * pair. Used to route integration-level webhook deliveries (e.g. Notion sends
 * one URL for all installations and identifies the source workspace by id).
 */
export const findConnectionByProviderAccount = internalQuery({
  args: {
    provider: v.union(
      v.literal("notion"),
      v.literal("raindrop"),
      v.literal("google_drive"),
      v.literal("readwise"),
      v.literal("github"),
      v.literal("linear")
    ),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    // Webhook fan-in volume is low; full table scan is fine for v1. If this
    // ever becomes hot, add a dedicated index on (provider, providerAccountId).
    const all = await ctx.db.query("connection").collect();
    const match = all.find(
      (c) =>
        c.provider === args.provider &&
        c.providerAccountId === args.providerAccountId &&
        c.status === "active" &&
        c.syncEnabled === true
    );
    return match ? { _id: match._id } : null;
  },
});

export const markWebhookReceived = internalMutation({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, { lastWebhookAt: Date.now() });
  },
});

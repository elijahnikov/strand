import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { resolveActingBillingAccount } from "../billing/resolver";
import { workspaceQuery } from "../utils";

/**
 * Gate the chat endpoint before `streamText` runs. Throws
 * `ConvexError("Insufficient credits")` when the user's balance is below the
 * estimate, which the TanStack Start handler surfaces as HTTP 402 so the UI
 * can render an upgrade CTA. BYO-key workspaces skip the check.
 */
export const preflightChat = workspaceQuery({
  args: {
    estimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const byo = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id)
      )
      .unique();
    if (byo) {
      return { ok: true as const, byo: true as const };
    }
    const resolved = await resolveActingBillingAccount(
      ctx,
      ctx.user._id,
      ctx.workspace._id
    );
    const estimate = args.estimate ?? 5;
    if (resolved.creditBalance < estimate) {
      throw new ConvexError("Insufficient credits");
    }
    return { ok: true as const, byo: false as const };
  },
});

export const searchResources = workspaceQuery({
  args: {
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.toLowerCase().trim();

    const searchHits = normalizedQuery
      ? await ctx.db
          .query("resource")
          .withSearchIndex("search_title", (q) =>
            q
              .search("title", normalizedQuery)
              .eq("workspaceId", ctx.workspace._id)
              .eq("deletedAt", undefined)
          )
          .take(args.limit * 2)
      : await ctx.db
          .query("resource")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", ctx.workspace._id).eq("deletedAt", undefined)
          )
          .order("desc")
          .take(args.limit);

    // Client-side substring filter to catch case/prefix matches that the
    // tokenized search might miss (e.g. "git" should match "GitHub").
    const filtered = normalizedQuery
      ? searchHits.filter((r) =>
          r.title.toLowerCase().includes(normalizedQuery)
        )
      : searchHits;

    const results = filtered.slice(0, args.limit);

    // Enrich with preview info (favicon for websites, fileUrl for files)
    return await Promise.all(
      results.map(async (r) => {
        let favicon: string | null = null;
        let fileUrl: string | null = null;
        let mimeType: string | null = null;

        if (r.type === "website") {
          const website = await ctx.db
            .query("websiteResource")
            .withIndex("by_resource", (q) => q.eq("resourceId", r._id))
            .unique();
          favicon = website?.favicon ?? null;
        } else if (r.type === "file") {
          const file = await ctx.db
            .query("fileResource")
            .withIndex("by_resource", (q) => q.eq("resourceId", r._id))
            .unique();
          mimeType = file?.mimeType ?? null;
          if (file?.storageId) {
            fileUrl = await ctx.storage.getUrl(file.storageId);
          }
        }

        return {
          _id: r._id,
          title: r.title,
          type: r.type,
          favicon,
          fileUrl,
          mimeType,
        };
      })
    );
  },
});

export const listThreads = workspaceQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatThread")
      .withIndex("by_workspace_user", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("userId", ctx.user._id)
          .eq("deletedAt", undefined)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getLatestThreadForResource = workspaceQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("chatThread")
      .withIndex("by_workspace_resource", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("resourceId", args.resourceId)
          .eq("deletedAt", undefined)
      )
      .order("desc")
      .first();
    return thread;
  },
});

export const getThread = workspaceQuery({
  args: {
    threadId: v.id("chatThread"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.workspaceId !== ctx.workspace._id ||
      thread.userId !== ctx.user._id ||
      thread.deletedAt
    ) {
      return null;
    }

    const messages = await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return { ...thread, messages };
  },
});

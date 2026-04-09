import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { workspaceQuery } from "../utils";

export const searchResources = workspaceQuery({
  args: {
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("resource")
      .withSearchIndex("search_title", (q) =>
        q
          .search("title", args.query)
          .eq("workspaceId", ctx.workspace._id)
          .eq("deletedAt", undefined)
      )
      .take(args.limit);

    return results.map((r) => ({
      _id: r._id,
      title: r.title,
      type: r.type,
      description: r.description,
    }));
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

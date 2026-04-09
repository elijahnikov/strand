import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const createThread = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    resourceId: v.optional(v.id("resource")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatThread", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      resourceId: args.resourceId,
      lastMessageAt: Date.now(),
    });
  },
});

export const saveMessage = internalMutation({
  args: {
    threadId: v.id("chatThread"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          resourceId: v.id("resource"),
          title: v.string(),
          type: v.string(),
          snippet: v.optional(v.string()),
          chunkIndex: v.optional(v.number()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("chatMessage", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      citations: args.citations,
      createdAt: now,
    });

    await ctx.db.patch(args.threadId, { lastMessageAt: now });
  },
});

export const getThreadMessages = internalQuery({
  args: {
    threadId: v.id("chatThread"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const validateMembership = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    if (workspace.ownerId === user._id) {
      return { user, workspace };
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();

    if (!member) {
      return null;
    }

    return { user, workspace };
  },
});

export const maybeSetThreadTitle = internalMutation({
  args: {
    threadId: v.id("chatThread"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.title) {
      return;
    }

    const title = args.content.slice(0, 60).trim();
    await ctx.db.patch(args.threadId, { title });
  },
});

export const titleSearch = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("resource")
      .withSearchIndex("search_title", (q) =>
        q
          .search("title", args.query)
          .eq("workspaceId", args.workspaceId)
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

export const getThreadById = internalQuery({
  args: {
    threadId: v.id("chatThread"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const getUserByAuthId = internalQuery({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

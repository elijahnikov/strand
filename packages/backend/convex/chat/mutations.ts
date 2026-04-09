import { ConvexError, v } from "convex/values";
import { workspaceMutation } from "../utils";

export const createThread = workspaceMutation({
  args: {
    resourceId: v.optional(v.id("resource")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatThread", {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      resourceId: args.resourceId,
      lastMessageAt: Date.now(),
    });
  },
});

export const deleteThread = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.workspaceId !== ctx.workspace._id ||
      thread.userId !== ctx.user._id
    ) {
      throw new ConvexError("Thread not found");
    }

    await ctx.db.patch(args.threadId, { deletedAt: Date.now() });
  },
});

export const saveUserMessage = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.workspaceId !== ctx.workspace._id ||
      thread.userId !== ctx.user._id
    ) {
      throw new ConvexError("Thread not found");
    }

    const now = Date.now();

    await ctx.db.insert("chatMessage", {
      threadId: args.threadId,
      role: "user",
      content: args.content,
      createdAt: now,
    });

    await ctx.db.patch(args.threadId, { lastMessageAt: now });
  },
});

export const updateThreadTitle = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.workspaceId !== ctx.workspace._id ||
      thread.userId !== ctx.user._id
    ) {
      throw new ConvexError("Thread not found");
    }

    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

export const saveAssistantMessage = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
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
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.workspaceId !== ctx.workspace._id ||
      thread.userId !== ctx.user._id
    ) {
      throw new ConvexError("Thread not found");
    }

    await ctx.db.insert("chatMessage", {
      threadId: args.threadId,
      role: "assistant",
      content: args.content,
      citations: args.citations,
      createdAt: Date.now(),
    });
  },
});

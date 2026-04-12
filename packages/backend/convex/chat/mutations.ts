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
    toolParts: v.optional(v.array(v.any())),
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
      toolParts: args.toolParts,
      createdAt: Date.now(),
    });
  },
});

/**
 * Generic patch for a persisted tool part's `output` field. Looks up the
 * containing chatMessage by `toolCallId` within `threadId` and shallow-merges
 * `outputPatch` into the part's `output`. Used by interactive tool result UIs
 * (e.g. ProposeCollectionCard) to record side effects after the user confirms,
 * without requiring a tool-specific mutation per use case.
 */
export const updateToolPartOutput = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
    toolCallId: v.string(),
    outputPatch: v.any(),
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

    const messages = await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      if (!message.toolParts) {
        continue;
      }
      const idx = (
        message.toolParts as Array<{ toolCallId?: string }>
      ).findIndex((p) => p?.toolCallId === args.toolCallId);
      if (idx === -1) {
        continue;
      }
      const target = message.toolParts[idx] as
        | { output?: Record<string, unknown> }
        | undefined;
      if (!target) {
        continue;
      }
      const updated = [...message.toolParts];
      updated[idx] = {
        ...target,
        output: { ...(target.output ?? {}), ...args.outputPatch },
      };
      await ctx.db.patch(message._id, { toolParts: updated });
      return { found: true };
    }

    return { found: false };
  },
});

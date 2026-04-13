import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const getMemoryRow = internalQuery({
  args: { memoryId: v.id("userMemory") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memoryId);
  },
});

export const setStatus = internalMutation({
  args: {
    memoryId: v.id("userMemory"),
    status: v.union(v.literal("idle"), v.literal("extracting")),
    expectedVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.memoryId);
    if (!row) {
      return { success: false, reason: "not_found" as const };
    }
    if (
      args.expectedVersion !== undefined &&
      row.version !== args.expectedVersion
    ) {
      return { success: false, reason: "version_mismatch" as const };
    }
    await ctx.db.patch(args.memoryId, { status: args.status });
    return { success: true, reason: null };
  },
});

export const upsertMemoryContent = internalMutation({
  args: {
    memoryId: v.id("userMemory"),
    content: v.string(),
    expectedVersion: v.number(),
    lastExtractedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.memoryId);
    if (!row) {
      return { success: false, reason: "not_found" as const };
    }
    if (row.version !== args.expectedVersion) {
      return { success: false, reason: "version_mismatch" as const };
    }
    await ctx.db.patch(args.memoryId, {
      content: args.content,
      version: row.version + 1,
      status: "idle",
      lastExtractedAt: args.lastExtractedAt,
      updatedAt: Date.now(),
    });
    return { success: true, reason: null };
  },
});

export const markExtractionSkipped = internalMutation({
  args: {
    memoryId: v.id("userMemory"),
    lastExtractedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.memoryId);
    if (!row) {
      return;
    }
    await ctx.db.patch(args.memoryId, {
      status: "idle",
      lastExtractedAt: args.lastExtractedAt,
      updatedAt: Date.now(),
    });
  },
});

export const markExtractionFailed = internalMutation({
  args: { memoryId: v.id("userMemory") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.memoryId);
    if (!row) {
      return;
    }
    await ctx.db.patch(args.memoryId, {
      status: "idle",
      lastErrorAt: Date.now(),
    });
  },
});

export const getMessagesInThreadSince = internalQuery({
  args: {
    threadId: v.id("chatThread"),
    sinceCreatedAt: v.optional(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const since = args.sinceCreatedAt ?? 0;
    const messages = await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) =>
        q.eq("threadId", args.threadId).gt("createdAt", since)
      )
      .take(args.limit);
    return messages.map((m) => ({
      _id: m._id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  },
});

export const getLatestMessageAtInThread = internalQuery({
  args: { threadId: v.id("chatThread") },
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .first();
    return msg?.createdAt ?? null;
  },
});

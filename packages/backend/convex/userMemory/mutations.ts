import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { workspaceMutation } from "../utils";

const EXTRACTION_DELAY_MS = 5 * 60_000;
const MIN_THREAD_LENGTH = 6;
const MANUAL_EDIT_GUARD_MS = 60_000;

export const scheduleExtraction = workspaceMutation({
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

    const messagesSample = await ctx.db
      .query("chatMessage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(MIN_THREAD_LENGTH);
    if (messagesSample.length < MIN_THREAD_LENGTH) {
      return;
    }

    const existing = await ctx.db
      .query("userMemory")
      .withIndex("by_user_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id)
      )
      .first();

    const now = Date.now();
    let memoryId: Id<"userMemory">;

    if (existing) {
      if (existing.status === "extracting") {
        return;
      }
      if (
        existing.lastManualEditAt &&
        now - existing.lastManualEditAt < MANUAL_EDIT_GUARD_MS
      ) {
        return;
      }
      memoryId = existing._id;
    } else {
      memoryId = await ctx.db.insert("userMemory", {
        workspaceId: ctx.workspace._id,
        userId: ctx.user._id,
        content: "",
        status: "idle",
        version: 0,
        updatedAt: now,
      });
    }

    await ctx.scheduler.runAfter(
      EXTRACTION_DELAY_MS,
      internal.userMemory.aiActions.extractUserMemory,
      {
        memoryId,
        threadId: args.threadId,
        scheduledAt: now,
      }
    );
  },
});

export const clearMemory = workspaceMutation({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("userMemory")
      .withIndex("by_user_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id)
      )
      .first();

    const now = Date.now();
    if (row) {
      await ctx.db.patch(row._id, {
        content: "",
        version: row.version + 1,
        status: "idle",
        lastManualEditAt: now,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("userMemory", {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      content: "",
      status: "idle",
      version: 0,
      lastManualEditAt: now,
      updatedAt: now,
    });
  },
});

"use node";

import { extractMemory, wordJaccardSimilarity } from "@omi/ai/memory";
import { createOpenAIProvider } from "@omi/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const RETRY_BACKOFFS = [5000, 30_000, 120_000];
const MIN_NEW_MESSAGES = 4;
const MAX_MESSAGES_IN_CTX = 40;
const SIMILARITY_FLOOR = 0.7;
const DRIFT_GUARD_MIN_MESSAGES = 8;
const MEMORY_EXTRACT_COST = 3;

export const extractUserMemory = internalAction({
  args: {
    memoryId: v.id("userMemory"),
    threadId: v.id("chatThread"),
    scheduledAt: v.number(),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return;
    }

    const row = await ctx.runQuery(internal.userMemory.internals.getMemoryRow, {
      memoryId: args.memoryId,
    });
    if (!row) {
      return;
    }

    const latestMessageAt = await ctx.runQuery(
      internal.userMemory.internals.getLatestMessageAtInThread,
      { threadId: args.threadId }
    );
    if (latestMessageAt && latestMessageAt > args.scheduledAt) {
      return;
    }

    const messages = await ctx.runQuery(
      internal.userMemory.internals.getMessagesInThreadSince,
      {
        threadId: args.threadId,
        sinceCreatedAt: row.lastExtractedAt,
        limit: MAX_MESSAGES_IN_CTX,
      }
    );

    if (messages.length < MIN_NEW_MESSAGES) {
      return;
    }

    const lock = await ctx.runMutation(
      internal.userMemory.internals.setStatus,
      {
        memoryId: args.memoryId,
        status: "extracting",
        expectedVersion: row.version,
      }
    );
    if (!lock.success) {
      return;
    }

    try {
      const provider = createOpenAIProvider(apiKey);
      const result = await extractMemory(provider, {
        existing: row.content,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const newContent = result.content.trim();
      const existingContent = row.content.trim();

      const similarity =
        existingContent.length > 0
          ? wordJaccardSimilarity(existingContent, newContent)
          : 1;
      const isDrifted =
        similarity < SIMILARITY_FLOOR &&
        messages.length < DRIFT_GUARD_MIN_MESSAGES;

      if (isDrifted) {
        console.log("[extractUserMemory] drift guard rejected update", {
          memoryId: args.memoryId,
          similarity,
          newMessages: messages.length,
        });
        await ctx.runMutation(
          internal.userMemory.internals.markExtractionSkipped,
          { memoryId: args.memoryId, lastExtractedAt: Date.now() }
        );
        return;
      }

      const write = await ctx.runMutation(
        internal.userMemory.internals.upsertMemoryContent,
        {
          memoryId: args.memoryId,
          content: newContent,
          expectedVersion: row.version,
          lastExtractedAt: Date.now(),
        }
      );
      if (write.success) {
        try {
          const resolved = await ctx.runQuery(
            internal.billing.resolver.resolveActing,
            { userId: row.userId, workspaceId: row.workspaceId }
          );
          await ctx.runMutation(internal.billing.credits.debit, {
            billingAccountId: resolved.billingAccountId,
            workspaceId: row.workspaceId,
            actingUserId: row.userId,
            reason: "memory-extract",
            amount: MEMORY_EXTRACT_COST,
          });
        } catch {
          // Swallow billing errors — don't undo a successful extraction.
        }
      } else {
        await ctx.runMutation(
          internal.userMemory.internals.markExtractionFailed,
          { memoryId: args.memoryId }
        );
      }
    } catch (error) {
      console.error("[extractUserMemory] failed", error);
      await ctx.runMutation(
        internal.userMemory.internals.markExtractionFailed,
        { memoryId: args.memoryId }
      );

      if (attempt < RETRY_BACKOFFS.length) {
        const delay = RETRY_BACKOFFS[attempt] as number;
        await ctx.scheduler.runAfter(
          delay,
          internal.userMemory.aiActions.extractUserMemory,
          {
            memoryId: args.memoryId,
            threadId: args.threadId,
            scheduledAt: args.scheduledAt,
            attempt: attempt + 1,
          }
        );
      }
    }
  },
});

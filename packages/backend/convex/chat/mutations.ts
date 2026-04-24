import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { tokensToCredits } from "../billing/credits";
import { resolveActingBillingAccount } from "../billing/resolver";
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
 * Called from the TanStack Start chat handler's `onFinish` callback with the
 * token usage the provider returned for that turn. Skips the debit when the
 * workspace has a BYO API key set (logs a zero-amount `kind:"byo-key"` row
 * for usage visibility instead). Swallows insufficient-balance errors — by
 * the time the stream has finished, we've already paid OpenAI and can't
 * un-stream the response; balance is allowed to drift marginally negative
 * on the last turn of a period, same tolerance the enrichment path uses.
 */
export const recordChatUsage = workspaceMutation({
  args: {
    threadId: v.id("chatThread"),
    promptTokens: v.number(),
    completionTokens: v.number(),
    model: v.string(),
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

    const byo = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id)
      )
      .unique();

    const resolved = await resolveActingBillingAccount(
      ctx,
      ctx.user._id,
      ctx.workspace._id
    );

    if (byo) {
      await ctx.runMutation(internal.billing.credits.logByoUsage, {
        billingAccountId: resolved.billingAccountId,
        workspaceId: ctx.workspace._id,
        actingUserId: ctx.user._id,
        reason: "chat",
      });
      return { debited: 0, byo: true as const };
    }

    const totalTokens = args.promptTokens + args.completionTokens;
    const amount = tokensToCredits(totalTokens, args.model);

    if (amount <= 0 || resolved.creditBalance < amount) {
      // Swallow: stream already ran. Record a best-effort zero-amount row so
      // the ledger shows the action happened.
      await ctx.db.insert("creditLedger", {
        billingAccountId: resolved.billingAccountId,
        workspaceId: ctx.workspace._id,
        actingUserId: ctx.user._id,
        kind: "debit",
        reason: "chat:underfunded",
        amount: 0,
        balanceAfter: resolved.creditBalance,
      });
      return { debited: 0, byo: false as const };
    }

    await ctx.runMutation(internal.billing.credits.debit, {
      billingAccountId: resolved.billingAccountId,
      workspaceId: ctx.workspace._id,
      actingUserId: ctx.user._id,
      reason: "chat",
      amount,
    });
    return { debited: amount, byo: false as const };
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

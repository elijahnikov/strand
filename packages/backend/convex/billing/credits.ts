import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { resolveActingBillingAccount } from "./resolver";

const MODEL_MULTIPLIER: Record<string, number> = {
  "text-embedding-3-small": 0.1,
  "text-embedding-3-large": 0.3,
  "gpt-4o-mini": 1,
  "gpt-4.1-mini": 2,
  "gpt-4o": 5,
  "gpt-4-turbo": 5,
  "gemini-2.5-flash": 0.25,
  "claude-haiku-4-5": 2.5,
  "claude-sonnet-4-6": 6,
};

export function tokensToCredits(tokens: number, model: string): number {
  const multiplier = MODEL_MULTIPLIER[model] ?? 1;
  return Math.max(1, Math.ceil((tokens / 1000) * multiplier));
}

export const debit = internalMutation({
  args: {
    billingAccountId: v.id("billingAccount"),
    workspaceId: v.id("workspace"),
    actingUserId: v.id("user"),
    reason: v.string(),
    amount: v.number(),
    resourceId: v.optional(v.id("resource")),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new ConvexError("Debit amount must be positive");
    }
    const account = await ctx.db.get(args.billingAccountId);
    if (!account) {
      throw new ConvexError("Billing account not found");
    }
    if (account.creditBalance < args.amount) {
      throw new ConvexError("Insufficient credits");
    }
    const next = account.creditBalance - args.amount;
    await ctx.db.patch(args.billingAccountId, { creditBalance: next });
    await ctx.db.insert("creditLedger", {
      billingAccountId: args.billingAccountId,
      workspaceId: args.workspaceId,
      actingUserId: args.actingUserId,
      kind: "debit",
      reason: args.reason,
      amount: -args.amount,
      balanceAfter: next,
      resourceId: args.resourceId,
    });
    return { balanceAfter: next };
  },
});

export const topUp = internalMutation({
  args: {
    billingAccountId: v.id("billingAccount"),
    workspaceId: v.optional(v.id("workspace")),
    actingUserId: v.id("user"),
    amount: v.number(),
    reason: v.string(),
    setBalance: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.billingAccountId);
    if (!account) {
      throw new ConvexError("Billing account not found");
    }
    const next = args.setBalance
      ? args.amount
      : account.creditBalance + args.amount;
    await ctx.db.patch(args.billingAccountId, { creditBalance: next });
    if (args.workspaceId) {
      await ctx.db.insert("creditLedger", {
        billingAccountId: args.billingAccountId,
        workspaceId: args.workspaceId,
        actingUserId: args.actingUserId,
        kind: "credit",
        reason: args.reason,
        amount: args.setBalance ? next - account.creditBalance : args.amount,
        balanceAfter: next,
      });
    }
    return { balanceAfter: next };
  },
});

/**
 * Writes a visibility-only ledger row when a workspace has BYO API keys set
 * and the AI call was paid by the user's own provider account. Balance is
 * unchanged; the row exists so Usage dashboards can surface "actions taken
 * via BYO" alongside debited ones.
 */
export const logByoUsage = internalMutation({
  args: {
    billingAccountId: v.id("billingAccount"),
    workspaceId: v.id("workspace"),
    actingUserId: v.id("user"),
    reason: v.string(),
    resourceId: v.optional(v.id("resource")),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.billingAccountId);
    if (!account) {
      throw new ConvexError("Billing account not found");
    }
    await ctx.db.insert("creditLedger", {
      billingAccountId: args.billingAccountId,
      workspaceId: args.workspaceId,
      actingUserId: args.actingUserId,
      kind: "byo-key",
      reason: args.reason,
      amount: 0,
      balanceAfter: account.creditBalance,
      resourceId: args.resourceId,
    });
  },
});

/**
 * Pre-flight check called from public actions before the provider is billed.
 * Short-circuits with `Insufficient credits` if the estimate exceeds balance.
 * Returns the resolved billing account so callsites can pass billingAccountId
 * straight to `debit` after the AI call returns.
 */
export const preflight = internalQuery({
  args: {
    userId: v.id("user"),
    workspaceId: v.optional(v.id("workspace")),
    estimate: v.number(),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveActingBillingAccount(
      ctx,
      args.userId,
      args.workspaceId
    );
    if (resolved.creditBalance < args.estimate) {
      throw new ConvexError("Insufficient credits");
    }
    return resolved;
  },
});

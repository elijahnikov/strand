import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { tierToAllotment } from "./pricing";

// Re-export for backward compat with existing imports (backfill.ts uses this).
export { TIER_ALLOTMENT, tierToAllotment } from "./pricing";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const planValidator = v.union(
  v.literal("free"),
  v.literal("basic"),
  v.literal("pro")
);

const cadenceValidator = v.union(v.literal("monthly"), v.literal("yearly"));

async function getPersonalAccountId(
  ctx: MutationCtx,
  userId: Id<"user">
): Promise<Id<"billingAccount">> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }
  if (!user.personalBillingAccountId) {
    throw new ConvexError("User has no personal billing account");
  }
  return user.personalBillingAccountId;
}

/**
 * Resolve the billing account by Stripe customer id. Preferred over userId
 * lookup inside webhook handlers — Stripe events always carry the customer id.
 */
async function getAccountByStripeCustomerId(
  ctx: MutationCtx,
  stripeCustomerId: string
): Promise<Id<"billingAccount"> | null> {
  const row = await ctx.db
    .query("billingAccount")
    .withIndex("by_stripe_customer", (q) =>
      q.eq("stripeCustomerId", stripeCustomerId)
    )
    .unique();
  return row?._id ?? null;
}

export const syncSubscriptionActive = internalMutation({
  args: {
    userId: v.id("user"),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    planTier: planValidator,
    cadence: cadenceValidator,
    currentPeriodEnd: v.number(),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accountId = await getPersonalAccountId(ctx, args.userId);
    await ctx.db.patch(accountId, {
      plan: args.planTier,
      billingCadence: args.cadence,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripeCurrentPeriodEnd: args.currentPeriodEnd,
      subscriptionStatus: args.subscriptionStatus,
    });
  },
});

export const syncSubscriptionCanceled = internalMutation({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const accountId = await getAccountByStripeCustomerId(
      ctx,
      args.stripeCustomerId
    );
    if (!accountId) {
      return;
    }
    await ctx.db.patch(accountId, {
      plan: "free",
      billingCadence: undefined,
      stripeSubscriptionId: undefined,
      stripePriceId: undefined,
      stripeCurrentPeriodEnd: undefined,
      subscriptionStatus: undefined,
    });
  },
});

/**
 * Top up an account to its tier allotment and arm the next 30-day reset.
 * Called on initial subscription activation and again on each monthly reset
 * (via the cron in `crons.ts`) — NOT driven by Stripe's billing interval,
 * so yearly subscribers still get monthly credit resets.
 */
export const topUpForPeriod = internalMutation({
  args: {
    billingAccountId: v.id("billingAccount"),
    planTier: planValidator,
    // `${subId}:${periodStart}:${plan}`. When the account's `lastTopUpKey`
    // already matches, we skip — this makes duplicate Stripe webhooks (retries,
    // CLI replays) a no-op so they don't wipe mid-period debits by resetting
    // balance to allotment. Omitted by the cron reset path which has its own
    // lock (`creditResetAt > now`).
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.billingAccountId);
    if (!account) {
      throw new ConvexError("Billing account not found");
    }
    if (
      args.idempotencyKey !== undefined &&
      account.lastTopUpKey === args.idempotencyKey
    ) {
      return {
        skipped: true as const,
        balanceAfter: account.creditBalance,
        resetAt: account.creditResetAt ?? 0,
      };
    }
    const allotment = tierToAllotment(args.planTier);
    const previousBalance = account.creditBalance;
    const resetAt = Date.now() + THIRTY_DAYS_MS;
    await ctx.db.patch(args.billingAccountId, {
      creditBalance: allotment,
      creditResetAt: resetAt,
      lastTopUpKey: args.idempotencyKey,
    });
    await ctx.db.insert("creditLedger", {
      billingAccountId: args.billingAccountId,
      actingUserId: account.ownerUserId,
      kind: "credit",
      reason: `period-renewal:${args.planTier}`,
      amount: allotment - previousBalance,
      balanceAfter: allotment,
    });
    return { skipped: false as const, balanceAfter: allotment, resetAt };
  },
});

/**
 * Refresh the stored Stripe period-end date. Called from the `invoice.paid`
 * event handler so the Billing UI shows the correct next-renewal date after
 * Stripe advances the subscription period. Does NOT top up credits — credit
 * resets are driven by the 30-day cron, independent of Stripe's cadence.
 */
export const touchCurrentPeriodEnd = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const accountId = await getAccountByStripeCustomerId(
      ctx,
      args.stripeCustomerId
    );
    if (!accountId) {
      return;
    }
    await ctx.db.patch(accountId, {
      stripeCurrentPeriodEnd: args.currentPeriodEnd,
    });
  },
});

/**
 * Cron-driven: reset any accounts whose `creditResetAt` has passed. Runs
 * daily; resets each account to its current tier's allotment and arms the
 * next 30-day window. Safe to re-run — only acts on accounts whose reset
 * timestamp is in the past.
 */
export const resetDueCredits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const accounts = await ctx.db.query("billingAccount").collect();
    let reset = 0;
    for (const account of accounts) {
      const resetAt = account.creditResetAt ?? 0;
      if (resetAt === 0 || resetAt > now) {
        continue;
      }
      const allotment = tierToAllotment(account.plan);
      const previousBalance = account.creditBalance;
      const nextResetAt = now + THIRTY_DAYS_MS;
      await ctx.db.patch(account._id, {
        creditBalance: allotment,
        creditResetAt: nextResetAt,
        lastTopUpKey: undefined,
      });
      await ctx.db.insert("creditLedger", {
        billingAccountId: account._id,
        actingUserId: account.ownerUserId,
        kind: "credit",
        reason: `period-renewal:${account.plan}`,
        amount: allotment - previousBalance,
        balanceAfter: allotment,
      });
      reset += 1;
    }
    return { reset };
  },
});

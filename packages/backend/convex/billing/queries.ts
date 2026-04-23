import { v } from "convex/values";
import { protectedQuery, workspaceQuery } from "../utils";
import { resolveActingBillingAccount } from "./resolver";

export const getMyBillingState = protectedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user.personalBillingAccountId) {
      return null;
    }
    const account = await ctx.db.get(ctx.user.personalBillingAccountId);
    if (!account) {
      return null;
    }
    return {
      billingAccountId: account._id,
      plan: account.plan,
      billingCadence: account.billingCadence ?? null,
      creditBalance: account.creditBalance,
      creditResetAt: account.creditResetAt,
      stripeCurrentPeriodEnd: account.stripeCurrentPeriodEnd,
      hasActiveSubscription: !!account.stripeSubscriptionId,
      subscriptionStatus: account.subscriptionStatus ?? null,
    };
  },
});

export const getActingPlan = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveActingBillingAccount(
      ctx,
      ctx.user._id,
      ctx.workspace._id
    );
    return { plan: resolved.plan, creditBalance: resolved.creditBalance };
  },
});

export const getMyUsageByWorkspace = protectedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user.personalBillingAccountId) {
      return [];
    }
    const accountId = ctx.user.personalBillingAccountId;
    const account = await ctx.db.get(accountId);
    const resetAt = account?.creditResetAt ?? 0;
    // Only debits in the current period. Top-ups / adjustments excluded.
    const rows = await ctx.db
      .query("creditLedger")
      .withIndex("by_account_time", (q) => q.eq("billingAccountId", accountId))
      .collect();
    const periodDebits = rows.filter(
      (r) =>
        r.kind === "debit" &&
        r.workspaceId !== undefined &&
        (resetAt === 0 || r._creationTime >= resetAt - 31 * 24 * 60 * 60 * 1000)
    );
    const byWorkspace = new Map<
      string,
      { workspaceId: string; credits: number }
    >();
    for (const row of periodDebits) {
      if (!row.workspaceId) {
        continue;
      }
      const key = row.workspaceId as string;
      const existing = byWorkspace.get(key);
      const spent = -row.amount;
      byWorkspace.set(key, {
        workspaceId: key,
        credits: (existing?.credits ?? 0) + spent,
      });
    }
    const results = await Promise.all(
      Array.from(byWorkspace.values()).map(async (entry) => {
        const ws = await ctx.db.get(
          entry.workspaceId as import("../_generated/dataModel").Id<"workspace">
        );
        return {
          workspaceId: entry.workspaceId,
          name: ws?.name ?? "Unknown",
          icon: ws?.icon ?? null,
          iconColor: ws?.iconColor ?? null,
          credits: entry.credits,
        };
      })
    );
    results.sort((a, b) => b.credits - a.credits);
    return results;
  },
});

export const getMyLedger = protectedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const accountId = ctx.user.personalBillingAccountId;
    if (!accountId) {
      return [];
    }
    const limit = Math.min(args.limit ?? 50, 200);
    const rows = await ctx.db
      .query("creditLedger")
      .withIndex("by_account_time", (q) => q.eq("billingAccountId", accountId))
      .order("desc")
      .take(limit);
    return rows;
  },
});

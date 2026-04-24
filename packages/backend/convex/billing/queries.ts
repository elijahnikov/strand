import { v } from "convex/values";
import { protectedQuery, workspaceQuery } from "../utils";
import { tierToStorageBytes } from "./pricing";
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
      storageBytesUsed: account.storageBytesUsed ?? 0,
      storageBytesAllotment: tierToStorageBytes(account.plan),
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

type UsageReasonKey = "chat" | "search" | "enrich" | "memory-extract" | "other";

function bucketReason(reason: string): UsageReasonKey {
  if (reason.startsWith("chat")) {
    return "chat";
  }
  if (reason.startsWith("search")) {
    return "search";
  }
  if (reason.startsWith("enrich")) {
    return "enrich";
  }
  if (reason.startsWith("memory")) {
    return "memory-extract";
  }
  return "other";
}

interface Entry {
  byReason: Record<UsageReasonKey, number>;
  credits: number;
  workspaceId: string;
}
export const getMyUsageByWorkspace = protectedQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user.personalBillingAccountId) {
      return [];
    }
    const accountId = ctx.user.personalBillingAccountId;
    const account = await ctx.db.get(accountId);
    const resetAt = account?.creditResetAt ?? 0;
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

    const byWorkspace = new Map<string, Entry>();
    for (const row of periodDebits) {
      if (!row.workspaceId) {
        continue;
      }
      const key = row.workspaceId as string;
      const spent = -row.amount;
      const bucket = bucketReason(row.reason);
      const existing: Entry = byWorkspace.get(key) ?? {
        workspaceId: key,
        credits: 0,
        byReason: {
          chat: 0,
          search: 0,
          enrich: 0,
          "memory-extract": 0,
          other: 0,
        },
      };
      existing.credits += spent;
      existing.byReason[bucket] += spent;
      byWorkspace.set(key, existing);
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
          byReason: entry.byReason,
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

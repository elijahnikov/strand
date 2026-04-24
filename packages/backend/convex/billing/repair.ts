import { ConvexError } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { getAuthIdentity } from "../utils";
import { type PaidPlan, planAndCadenceToPriceId } from "./pricing";

type ResyncResult =
  | { status: "no-auth-user" }
  | { status: "no-active-subscription" }
  | { status: "subscription-missing-fields" }
  | { status: "unknown-plan"; plan: string; interval?: string }
  | {
      status: "resynced";
      plan: "free" | "basic" | "pro";
      cadence: "monthly" | "yearly";
    };

function isPaidPlan(value: string): value is PaidPlan {
  return value === "basic" || value === "pro";
}

export const resyncMySubscription = action({
  args: {},
  handler: async (ctx): Promise<ResyncResult> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const userId = identity.userId as Id<"user">;
    const authId = await ctx.runQuery(
      components.betterAuth.queries.getAuthIdForUser,
      { userId }
    );
    if (!authId) {
      return { status: "no-auth-user" as const };
    }
    const sub = await ctx.runQuery(
      components.betterAuth.queries.getLatestSubscriptionForReference,
      { referenceId: authId as string }
    );
    if (!sub) {
      return { status: "no-active-subscription" as const };
    }
    const stripeCustomerId = sub.stripeCustomerId;
    const stripeSubscriptionId = sub.stripeSubscriptionId;
    if (!(stripeCustomerId && stripeSubscriptionId && sub.plan)) {
      return { status: "subscription-missing-fields" as const };
    }
    const rawPlan: string = sub.plan;
    if (!isPaidPlan(rawPlan)) {
      return {
        status: "unknown-plan" as const,
        plan: rawPlan,
        interval: sub.billingInterval ?? undefined,
      };
    }
    const cadence: "monthly" | "yearly" =
      sub.billingInterval === "year" ? "yearly" : "monthly";
    const priceId = planAndCadenceToPriceId(rawPlan, cadence);
    if (!priceId) {
      return {
        status: "unknown-plan" as const,
        plan: rawPlan,
        interval: sub.billingInterval ?? undefined,
      };
    }
    const coerce = (value: unknown): number => {
      if (typeof value === "number") {
        return value;
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    const currentPeriodEnd = coerce(sub.periodEnd);
    const periodStart = coerce(sub.periodStart);
    await ctx.runMutation(internal.billing.sync.syncSubscriptionActive, {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      planTier: rawPlan,
      cadence,
      currentPeriodEnd,
      subscriptionStatus: sub.status ?? undefined,
    });
    const resolved = await ctx.runQuery(
      internal.billing.resolver.resolveActing,
      { userId }
    );
    await ctx.runMutation(internal.billing.sync.topUpForPeriod, {
      billingAccountId: resolved.billingAccountId,
      planTier: rawPlan,
      idempotencyKey: `${stripeSubscriptionId}:${periodStart}:${rawPlan}`,
    });
    return {
      status: "resynced" as const,
      plan: rawPlan,
      cadence,
    };
  },
});

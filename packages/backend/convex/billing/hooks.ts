import type Stripe from "stripe";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { type PaidPlan, planAndCadenceToPriceId } from "./pricing";

type BetterAuthCtx = ActionCtx;

interface PluginSubscription {
  billingInterval?: "day" | "week" | "month" | "year" | undefined;
  periodEnd?: Date | number | string | undefined;
  periodStart?: Date | number | string | undefined;
  plan?: string | undefined;
  priceId?: string | undefined;
  referenceId: string;
  status?: string | undefined;
  stripeCustomerId?: string | undefined;
  stripeSubscriptionId?: string | undefined;
}

function isPaidPlan(value: string): value is PaidPlan {
  return value === "basic" || value === "pro";
}

const TIER_RANK: Record<"free" | PaidPlan, number> = {
  free: 0,
  basic: 1,
  pro: 2,
};

function coerceTimestampMs(value: Date | number | string | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function applyActiveSubscription(
  ctx: BetterAuthCtx,
  subscription: PluginSubscription,
  opts: { topUp: boolean }
): Promise<void> {
  const stripeCustomerId = subscription.stripeCustomerId;
  const stripeSubscriptionId = subscription.stripeSubscriptionId;
  if (!(stripeCustomerId && stripeSubscriptionId && subscription.plan)) {
    return;
  }
  const planName = subscription.plan;
  if (!isPaidPlan(planName)) {
    return;
  }
  const cadence: "monthly" | "yearly" =
    subscription.billingInterval === "year" ? "yearly" : "monthly";
  const priceId =
    subscription.priceId ?? planAndCadenceToPriceId(planName, cadence);
  if (!priceId) {
    return;
  }

  const appUserId = await ctx.runQuery(
    components.betterAuth.queries.getAppUserId,
    { authId: subscription.referenceId as Id<"user"> }
  );
  if (!appUserId) {
    return;
  }
  const userId = appUserId as Id<"user">;
  const currentPeriodEnd = coerceTimestampMs(subscription.periodEnd);
  const periodStart = coerceTimestampMs(subscription.periodStart);

  const before = await ctx.runQuery(internal.billing.resolver.resolveActing, {
    userId,
  });

  await ctx.runMutation(internal.billing.sync.syncSubscriptionActive, {
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: priceId,
    planTier: planName,
    cadence,
    currentPeriodEnd,
    subscriptionStatus: subscription.status,
  });

  const isUpgrade = TIER_RANK[planName] > TIER_RANK[before.plan];
  if (opts.topUp || isUpgrade) {
    await ctx.runMutation(internal.billing.sync.topUpForPeriod, {
      billingAccountId: before.billingAccountId,
      planTier: planName,
      idempotencyKey: `${stripeSubscriptionId}:${periodStart}:${planName}`,
    });
  }
}

export async function applyCanceledSubscription(
  ctx: BetterAuthCtx,
  subscription: PluginSubscription
): Promise<void> {
  if (!subscription.stripeCustomerId) {
    return;
  }
  await ctx.runMutation(internal.billing.sync.syncSubscriptionCanceled, {
    stripeCustomerId: subscription.stripeCustomerId,
  });
}

export async function handleStripeEvent(
  ctx: BetterAuthCtx,
  event: Stripe.Event
): Promise<void> {
  if (event.type !== "invoice.paid") {
    return;
  }
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!stripeCustomerId) {
    return;
  }
  const recurringLine = invoice.lines.data.find(
    (l) =>
      l.parent?.type === "subscription_item_details" &&
      l.parent.subscription_item_details?.proration !== true
  );
  const periodEnd = recurringLine?.period?.end;
  if (!periodEnd) {
    return;
  }
  await ctx.runMutation(internal.billing.sync.touchCurrentPeriodEnd, {
    stripeCustomerId,
    currentPeriodEnd: periodEnd * 1000,
  });
}

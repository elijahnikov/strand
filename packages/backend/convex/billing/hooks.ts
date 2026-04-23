/**
 * Helpers invoked from Better Auth Stripe plugin lifecycle hooks. Kept in
 * their own module so the auth config doesn't import the full billing graph
 * and codegen stays clean.
 *
 * These helpers take a Convex action/mutation-capable `ctx` (passed through
 * from `createAuth(ctx)` closure) and call our internal billing mutations.
 */

import type Stripe from "stripe";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { type PaidPlan, planAndCadenceToPriceId } from "./pricing";

/**
 * The Better Auth Stripe plugin runs inside an HTTP action, so the closed-over
 * Convex ctx is an ActionCtx with `runMutation` / `runQuery`.
 */
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

/**
 * The Convex Better Auth adapter doesn't round-trip Date objects — period
 * fields come back as a number (ms) or an ISO string, not `instanceof Date`.
 * Handle all three shapes so the UI always gets a real timestamp.
 */
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

/**
 * Mirror an active subscription onto the user's personal billingAccount and
 * top them up to the plan allotment. Called from both
 * `onSubscriptionComplete` (initial checkout) and `onSubscriptionUpdate`
 * (plan changes, renewals).
 *
 * The plugin's persisted `subscription` row doesn't always carry `priceId` —
 * the plugin derives it on the fly from `plan` + `billingInterval`. We do the
 * same here so both fresh-checkout and renewal flows converge on the same
 * plan/cadence regardless of which field is populated.
 */
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
  // `referenceId` is the Better Auth component user `_id`. Our app user `_id`
  // lives in the `userId` column on that row, stamped by the `setUserId`
  // mutation during the user `onCreate` trigger.
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

  // Snapshot the pre-sync plan so we can detect tier upgrades below.
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

  // Top up on (a) initial checkout activation, or (b) a tier upgrade — e.g.
  // Basic → Pro via the portal. Cadence changes within the same tier and
  // downgrades don't refill; downgrades keep existing balance and the next
  // monthly reset moves them to the lower allotment.
  const isUpgrade = TIER_RANK[planName] > TIER_RANK[before.plan];
  if (opts.topUp || isUpgrade) {
    await ctx.runMutation(internal.billing.sync.topUpForPeriod, {
      billingAccountId: before.billingAccountId,
      planTier: planName,
      idempotencyKey: `${stripeSubscriptionId}:${periodStart}:${planName}`,
    });
  }
}

/**
 * Flip an account back to Free when Stripe reports the subscription ended.
 */
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

/**
 * Catch-all for events the plugin's typed lifecycle hooks don't surface.
 * Used to refresh `stripeCurrentPeriodEnd` on `invoice.paid` so the UI shows
 * the right renewal date after Stripe advances the period on renewal.
 *
 * Plan-change invoices contain proration line items (credit for the unused
 * portion of the OLD plan, charge for the NEW plan). The credit line's
 * `period.end` points at the old plan's horizon — for a yearly→monthly
 * switch, that's ~a year out. We filter proration lines to avoid stamping
 * the old horizon onto the new subscription. On a pure-proration invoice,
 * `onSubscriptionUpdate` already carried the correct periodEnd, so we skip.
 */
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

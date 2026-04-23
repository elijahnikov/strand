import type { Plan } from "./resolver";

export type BillingCadence = "monthly" | "yearly";

/**
 * Monthly credit allotment per plan. Yearly subscribers receive this same
 * amount every 30 days — they do NOT get 12x upfront. This keeps the credit
 * reset cadence decoupled from Stripe's billing cadence.
 */
export const TIER_ALLOTMENT: Record<Plan, number> = {
  free: 500,
  basic: 3000,
  pro: 10_000,
};

export function tierToAllotment(plan: Plan): number {
  return TIER_ALLOTMENT[plan];
}

/**
 * Plan names fed to the Better Auth Stripe plugin. The plugin accepts
 * `priceId` (monthly) and `annualDiscountPriceId` (yearly) per plan, so one
 * entry per tier covers both cadences.
 */
export const PAID_PLANS = ["basic", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export interface PlanPricing {
  monthlyPriceId: string;
  name: PaidPlan;
  yearlyPriceId: string;
}

function envOr(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing Stripe price env: ${name}`);
  }
  return value;
}

/**
 * Called lazily (inside the plugin's `plans` function) so missing env vars
 * don't crash module import during codegen. Read envs at request time.
 */
export function getPaidPlans(): PlanPricing[] {
  return [
    {
      name: "basic",
      monthlyPriceId: envOr("STRIPE_PRICE_BASIC_MONTHLY"),
      yearlyPriceId: envOr("STRIPE_PRICE_BASIC_YEARLY"),
    },
    {
      name: "pro",
      monthlyPriceId: envOr("STRIPE_PRICE_PRO_MONTHLY"),
      yearlyPriceId: envOr("STRIPE_PRICE_PRO_YEARLY"),
    },
  ];
}

/**
 * Resolve a Stripe price ID back to our internal `{plan, cadence}` tuple.
 * Used by subscription sync callbacks — Stripe tells us the priceId, we map
 * it to the tier that drives allotment + the cadence surfaced in the UI.
 */
export function priceIdToPlan(
  priceId: string
): { plan: Plan; cadence: BillingCadence } | null {
  for (const p of getPaidPlans()) {
    if (p.monthlyPriceId === priceId) {
      return { plan: p.name, cadence: "monthly" };
    }
    if (p.yearlyPriceId === priceId) {
      return { plan: p.name, cadence: "yearly" };
    }
  }
  return null;
}

/**
 * Inverse of `priceIdToPlan`: given the plan name + cadence stored on a
 * Better Auth subscription row, return the matching Stripe price ID. Used by
 * repair tooling where the subscription row holds `plan` + `billingInterval`
 * rather than a priceId.
 */
export function planAndCadenceToPriceId(
  plan: PaidPlan,
  cadence: BillingCadence
): string | null {
  const pricing = getPaidPlans().find((p) => p.name === plan);
  if (!pricing) {
    return null;
  }
  return cadence === "yearly" ? pricing.yearlyPriceId : pricing.monthlyPriceId;
}

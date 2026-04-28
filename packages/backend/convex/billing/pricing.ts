import type { Plan } from "./resolver";

export type BillingCadence = "monthly" | "yearly";

export const TIER_ALLOTMENT: Record<Plan, number> = {
  free: 500,
  basic: 3000,
  pro: 10_000,
};

export function tierToAllotment(plan: Plan): number {
  return TIER_ALLOTMENT[plan];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const TIER_STORAGE_BYTES: Record<Plan, number> = {
  free: 100 * MB,
  basic: 5 * GB,
  pro: 25 * GB,
};

export function tierToStorageBytes(plan: Plan): number {
  return TIER_STORAGE_BYTES[plan];
}

export const TIER_WORKSPACE_LIMIT: Record<Plan, number> = {
  free: 3,
  basic: Number.POSITIVE_INFINITY,
  pro: Number.POSITIVE_INFINITY,
};

export function tierToWorkspaceLimit(plan: Plan): number {
  return TIER_WORKSPACE_LIMIT[plan];
}

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

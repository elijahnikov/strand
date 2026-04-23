import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { createHarness, seedUser } from "../../test/harness";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  applyActiveSubscription,
  applyCanceledSubscription,
  handleStripeEvent,
} from "./hooks";

type TestHarness = ReturnType<typeof createHarness>;

// Fake ActionCtx for the billing hooks. The hooks' only cross-component call
// (`components.betterAuth.queries.getAppUserId`) is a pure map from the
// component's user `_id` to our app user `_id`, so we short-circuit it here
// rather than seeding the betterAuth component's user table. Everything else
// flows to the real harness via `t.query` / `t.mutation`, so billing-table
// assertions observe real state.
// Component FunctionReferences are Proxies that expose their target path via
// the global `Symbol.for("toReferencePath")`. We use that to detect the one
// Better Auth call the hooks make without needing to seed the component's
// user table.
const TO_REFERENCE_PATH = Symbol.for("toReferencePath");
const GET_APP_USER_ID_PATH =
  "_reference/childComponent/betterAuth/queries/getAppUserId";

function makeFakeCtx(
  t: TestHarness,
  authToUser: Map<string, Id<"user">>
): ActionCtx {
  return {
    runQuery: async (fn: any, args: any) => {
      const path = fn?.[TO_REFERENCE_PATH];
      if (path === GET_APP_USER_ID_PATH) {
        return authToUser.get(args.authId) ?? null;
      }
      return await t.query(fn, args);
    },
    runMutation: async (fn: any, args: any) => await t.mutation(fn, args),
  } as unknown as ActionCtx;
}

async function seedBillingUser(t: TestHarness): Promise<{
  authId: string;
  userId: Id<"user">;
  accountId: Id<"billingAccount">;
}> {
  const { userId } = await seedUser(t);
  const accountId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("billingAccount", {
      type: "individual",
      ownerUserId: userId,
      plan: "free",
      creditBalance: 500,
      creditResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    await ctx.db.patch(userId, { personalBillingAccountId: id });
    return id;
  });
  // Opaque Better Auth component user id — the fake ctx maps it back below.
  const authId = `auth_${userId}`;
  return { authId, userId, accountId };
}

const BASIC_MONTHLY_PRICE = "price_basic_monthly_test";
const BASIC_YEARLY_PRICE = "price_basic_yearly_test";
const PRO_MONTHLY_PRICE = "price_pro_monthly_test";
const PRO_YEARLY_PRICE = "price_pro_yearly_test";

interface BuildSubArgs {
  authId: string;
  cadence?: "monthly" | "yearly";
  customerId?: string;
  periodEnd?: number;
  periodStart?: number;
  plan: "basic" | "pro";
  status?: string;
  subId?: string;
}

function buildSubscription(args: BuildSubArgs) {
  const cadence = args.cadence ?? "monthly";
  const priceId =
    args.plan === "pro"
      ? cadence === "yearly"
        ? PRO_YEARLY_PRICE
        : PRO_MONTHLY_PRICE
      : cadence === "yearly"
        ? BASIC_YEARLY_PRICE
        : BASIC_MONTHLY_PRICE;
  return {
    referenceId: args.authId,
    plan: args.plan,
    priceId,
    billingInterval: (cadence === "yearly" ? "year" : "month") as
      | "year"
      | "month",
    periodStart: args.periodStart ?? 1_700_000_000_000,
    periodEnd: args.periodEnd ?? 1_702_592_000_000,
    status: args.status,
    stripeCustomerId: args.customerId ?? "cus_test_123",
    stripeSubscriptionId: args.subId ?? "sub_test_abc",
  };
}

describe("applyActiveSubscription", () => {
  it("initial activation tops up to Pro allotment and stamps lastTopUpKey", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    await applyActiveSubscription(
      ctx,
      buildSubscription({ plan: "pro", cadence: "monthly", authId }),
      { topUp: true }
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("pro");
    expect(account?.billingCadence).toBe("monthly");
    expect(account?.creditBalance).toBe(10_000);
    expect(account?.stripeSubscriptionId).toBe("sub_test_abc");
    expect(account?.lastTopUpKey).toBe("sub_test_abc:1700000000000:pro");

    const ledger = await t.run(async (c) =>
      c.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(ledger.filter((r) => r.kind === "credit")).toHaveLength(1);
  });

  it("basic→pro upgrade tops up to Pro allotment even with topUp:false", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    // Seed as Basic with a partial balance (simulating mid-period debits).
    await t.run(async (c) =>
      c.db.patch(accountId, { plan: "basic", creditBalance: 1500 })
    );

    await applyActiveSubscription(
      ctx,
      buildSubscription({ plan: "pro", cadence: "monthly", authId }),
      { topUp: false }
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("pro");
    expect(account?.creditBalance).toBe(10_000);
  });

  it("pro→basic downgrade keeps existing balance (no top-up)", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    await t.run(async (c) =>
      c.db.patch(accountId, { plan: "pro", creditBalance: 7200 })
    );

    await applyActiveSubscription(
      ctx,
      buildSubscription({ plan: "basic", cadence: "monthly", authId }),
      { topUp: false }
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("basic");
    expect(account?.creditBalance).toBe(7200);

    const topUps = await t.run(async (c) =>
      c.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .filter((q) => q.eq(q.field("kind"), "credit"))
        .collect()
    );
    expect(topUps).toHaveLength(0);
  });

  it("cadence swap (pro yearly → pro monthly) updates cadence, preserves balance", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    await t.run(async (c) =>
      c.db.patch(accountId, {
        plan: "pro",
        billingCadence: "yearly",
        creditBalance: 4200,
      })
    );

    await applyActiveSubscription(
      ctx,
      buildSubscription({ plan: "pro", cadence: "monthly", authId }),
      { topUp: false }
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("pro");
    expect(account?.billingCadence).toBe("monthly");
    expect(account?.creditBalance).toBe(4200);
  });

  it("duplicate activation with same (sub,periodStart,plan) is skipped", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    const sub = buildSubscription({ plan: "pro", cadence: "monthly", authId });
    await applyActiveSubscription(ctx, sub, { topUp: true });

    // Simulate the user spending credits mid-period before the retry fires.
    await t.run(async (c) => c.db.patch(accountId, { creditBalance: 6500 }));

    // Retry: same payload, same idempotency key. Top-up must be a no-op.
    await applyActiveSubscription(ctx, sub, { topUp: true });

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.creditBalance).toBe(6500);

    const topUps = await t.run(async (c) =>
      c.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .filter((q) => q.eq(q.field("kind"), "credit"))
        .collect()
    );
    expect(topUps).toHaveLength(1);
  });

  it("past_due status is surfaced without changing plan", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    // Already on Pro.
    await t.run(async (c) =>
      c.db.patch(accountId, { plan: "pro", creditBalance: 7200 })
    );

    await applyActiveSubscription(
      ctx,
      buildSubscription({
        plan: "pro",
        cadence: "monthly",
        authId,
        status: "past_due",
      }),
      { topUp: false }
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("pro");
    expect(account?.subscriptionStatus).toBe("past_due");
    expect(account?.creditBalance).toBe(7200);
  });
});

describe("applyCanceledSubscription", () => {
  it("flips plan to Free and clears Stripe identity + status", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    // Simulate an active Pro sub first.
    await applyActiveSubscription(
      ctx,
      buildSubscription({
        plan: "pro",
        cadence: "monthly",
        authId,
        status: "active",
      }),
      { topUp: true }
    );

    await applyCanceledSubscription(ctx, {
      referenceId: authId,
      stripeCustomerId: "cus_test_123",
    });

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.plan).toBe("free");
    expect(account?.stripeSubscriptionId).toBeUndefined();
    expect(account?.billingCadence).toBeUndefined();
    expect(account?.subscriptionStatus).toBeUndefined();
    // Balance left intact — the cron reset owns the Free-tier reset.
    expect(account?.creditBalance).toBe(10_000);
  });
});

function buildInvoiceEvent(
  customerId: string,
  lines: Array<{ proration: boolean; periodEnd: number }>
): Stripe.Event {
  return {
    type: "invoice.paid",
    data: {
      object: {
        customer: customerId,
        lines: {
          data: lines.map((l) => ({
            period: { end: l.periodEnd },
            parent: {
              type: "subscription_item_details",
              subscription_item_details: { proration: l.proration },
            },
          })),
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent (invoice.paid)", () => {
  it("skips when every line is a proration credit (keeps existing periodEnd)", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    // Prime with an active sub so periodEnd is set, then fire a pure-proration invoice.
    await applyActiveSubscription(
      ctx,
      buildSubscription({
        plan: "pro",
        cadence: "monthly",
        authId,
        periodEnd: 1_702_592_000_000,
      }),
      { topUp: true }
    );

    await handleStripeEvent(
      ctx,
      buildInvoiceEvent("cus_test_123", [
        { proration: true, periodEnd: 1_999_999_999 },
      ])
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    // Unchanged — proration-only invoice should not move the horizon.
    expect(account?.stripeCurrentPeriodEnd).toBe(1_702_592_000_000);
  });

  it("updates stripeCurrentPeriodEnd from the recurring subscription line", async () => {
    const t = createHarness();
    const { authId, userId, accountId } = await seedBillingUser(t);
    const ctx = makeFakeCtx(t, new Map([[authId, userId]]));

    await applyActiveSubscription(
      ctx,
      buildSubscription({
        plan: "pro",
        cadence: "monthly",
        authId,
        periodEnd: 1_702_592_000_000,
      }),
      { topUp: true }
    );

    const recurringPeriodEndSec = 1_800_000_000;
    await handleStripeEvent(
      ctx,
      buildInvoiceEvent("cus_test_123", [
        { proration: true, periodEnd: 1234 },
        { proration: false, periodEnd: recurringPeriodEndSec },
      ])
    );

    const account = await t.run(async (c) => c.db.get(accountId));
    expect(account?.stripeCurrentPeriodEnd).toBe(recurringPeriodEndSec * 1000);
  });
});

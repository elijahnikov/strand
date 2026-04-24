import { describe, expect, it } from "vitest";
import { createHarness, seedUser } from "../../test/harness";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { tokensToCredits } from "./credits";

async function seedAccount(
  t: ReturnType<typeof createHarness>,
  balance = 100
): Promise<{ userId: Id<"user">; accountId: Id<"billingAccount"> }> {
  const { userId } = await seedUser(t);
  const accountId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("billingAccount", {
      type: "individual",
      ownerUserId: userId,
      plan: "free",
      creditBalance: balance,
    });
    await ctx.db.patch(userId, { personalBillingAccountId: id });
    return id;
  });
  return { userId, accountId };
}

describe("tokensToCredits", () => {
  it("multiplies tokens by the model's multiplier and ceils", () => {
    expect(tokensToCredits(2500, "gpt-4.1-mini")).toBe(5);
    expect(tokensToCredits(1000, "gpt-4.1-mini")).toBe(2);
  });

  it("falls back to multiplier 1 for unknown models", () => {
    expect(tokensToCredits(1500, "mystery-model")).toBe(2);
  });

  it("floors at 1 credit minimum", () => {
    expect(tokensToCredits(0, "gpt-4o-mini")).toBe(1);
    expect(tokensToCredits(10, "gpt-4o-mini")).toBe(1);
  });

  it("scales Gemini Flash down by 0.25x", () => {
    expect(tokensToCredits(4500, "gemini-2.5-flash")).toBe(2);
  });
});

describe("billing/credits debit", () => {
  it("decrements balance and appends a ledger row", async () => {
    const t = createHarness();
    const { userId, accountId } = await seedAccount(t, 100);
    const workspaceId = await t.run(async (ctx) =>
      ctx.db.insert("workspace", {
        name: "w",
        ownerId: userId,
      })
    );

    await t.mutation(internal.billing.credits.debit, {
      billingAccountId: accountId,
      workspaceId,
      actingUserId: userId,
      reason: "chat",
      amount: 10,
    });

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(90);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(-10);
    expect(rows[0]?.kind).toBe("debit");
    expect(rows[0]?.balanceAfter).toBe(90);
  });

  it("throws and writes nothing when balance is insufficient", async () => {
    const t = createHarness();
    const { userId, accountId } = await seedAccount(t, 5);
    const workspaceId = await t.run(async (ctx) =>
      ctx.db.insert("workspace", {
        name: "w",
        ownerId: userId,
      })
    );

    await expect(
      t.mutation(internal.billing.credits.debit, {
        billingAccountId: accountId,
        workspaceId,
        actingUserId: userId,
        reason: "chat",
        amount: 10,
      })
    ).rejects.toThrow(/Insufficient credits/);

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(5);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(rows).toHaveLength(0);
  });
});

describe("preflight", () => {
  it("throws when estimate exceeds balance", async () => {
    const t = createHarness();
    const { userId } = await seedAccount(t, 3);
    await expect(
      t.query(internal.billing.credits.preflight, {
        userId,
        estimate: 10,
      })
    ).rejects.toThrow(/Insufficient credits/);
  });

  it("returns the resolved account when balance covers the estimate", async () => {
    const t = createHarness();
    const { userId, accountId } = await seedAccount(t, 50);
    const resolved = await t.query(internal.billing.credits.preflight, {
      userId,
      estimate: 10,
    });
    expect(resolved.billingAccountId).toBe(accountId);
    expect(resolved.creditBalance).toBe(50);
  });
});

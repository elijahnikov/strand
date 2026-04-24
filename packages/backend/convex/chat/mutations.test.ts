import { describe, expect, it } from "vitest";
import {
  asUser,
  createHarness,
  seedUser,
  seedWorkspace,
} from "../../test/harness";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

interface Seeded {
  accountId: Id<"billingAccount">;
  identity: { subject: string; userId: string };
  threadId: Id<"chatThread">;
  userId: Id<"user">;
  workspaceId: Id<"workspace">;
}

async function seed(
  t: ReturnType<typeof createHarness>,
  balance: number
): Promise<Seeded> {
  const { userId, identity } = await seedUser(t);
  const workspaceId = await seedWorkspace(t, userId);
  const { accountId, threadId } = await t.run(async (ctx) => {
    const id = await ctx.db.insert("billingAccount", {
      type: "individual",
      ownerUserId: userId,
      plan: "free",
      creditBalance: balance,
    });
    await ctx.db.patch(userId, { personalBillingAccountId: id });
    const tId = await ctx.db.insert("chatThread", {
      workspaceId,
      userId,
      lastMessageAt: Date.now(),
    });
    return { accountId: id, threadId: tId };
  });
  return { userId, workspaceId, threadId, accountId, identity };
}

describe("recordChatUsage", () => {
  it("debits ceil((prompt + completion)/1000 * multiplier) for gpt-4.1-mini", async () => {
    const t = createHarness();
    const { workspaceId, threadId, accountId, identity } = await seed(t, 100);

    const result = await asUser(t, identity).mutation(
      api.chat.mutations.recordChatUsage,
      {
        workspaceId,
        threadId,
        promptTokens: 1000,
        completionTokens: 500,
        model: "gpt-4.1-mini",
      }
    );

    expect(result.debited).toBe(3);
    expect(result.byo).toBe(false);

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(97);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("debit");
    expect(rows[0]?.reason).toBe("chat");
    expect(rows[0]?.amount).toBe(-3);
  });

  it("falls back to multiplier 1 for unknown models", async () => {
    const t = createHarness();
    const { workspaceId, threadId, accountId, identity } = await seed(t, 100);

    const result = await asUser(t, identity).mutation(
      api.chat.mutations.recordChatUsage,
      {
        workspaceId,
        threadId,
        promptTokens: 1000,
        completionTokens: 1000,
        model: "mystery-model",
      }
    );

    expect(result.debited).toBe(2);
    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(98);
  });

  it("swallows insufficient-balance: writes a zero-amount 'chat:underfunded' row and leaves balance intact", async () => {
    const t = createHarness();
    const { workspaceId, threadId, accountId, identity } = await seed(t, 1);

    const result = await asUser(t, identity).mutation(
      api.chat.mutations.recordChatUsage,
      {
        workspaceId,
        threadId,
        promptTokens: 2000,
        completionTokens: 1000,
        model: "gpt-4.1-mini",
      }
    );

    expect(result.debited).toBe(0);
    expect(result.byo).toBe(false);

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(1);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(0);
    expect(rows[0]?.reason).toBe("chat:underfunded");
  });

  it("skips the debit when the workspace has a BYO key and writes a byo-key ledger row", async () => {
    const t = createHarness();
    const { userId, workspaceId, threadId, accountId, identity } = await seed(
      t,
      100
    );
    await t.run(async (ctx) =>
      ctx.db.insert("workspaceAIProvider", {
        workspaceId,
        provider: "openai",
        encryptedApiKey: "stub",
        model: "gpt-4.1-mini",
        createdByUserId: userId,
        lastValidatedAt: Date.now(),
      })
    );

    const result = await asUser(t, identity).mutation(
      api.chat.mutations.recordChatUsage,
      {
        workspaceId,
        threadId,
        promptTokens: 5000,
        completionTokens: 2000,
        model: "gpt-4.1-mini",
      }
    );

    expect(result.debited).toBe(0);
    expect(result.byo).toBe(true);

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.creditBalance).toBe(100);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("creditLedger")
        .withIndex("by_account_time", (q) =>
          q.eq("billingAccountId", accountId)
        )
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("byo-key");
    expect(rows[0]?.reason).toBe("chat");
    expect(rows[0]?.amount).toBe(0);
  });

  it("rejects when the caller is not a member of the thread's workspace", async () => {
    const t = createHarness();
    const { workspaceId, threadId } = await seed(t, 100);
    const outsider = await seedUser(t);
    await expect(
      asUser(t, outsider.identity).mutation(
        api.chat.mutations.recordChatUsage,
        {
          workspaceId,
          threadId,
          promptTokens: 100,
          completionTokens: 100,
          model: "gpt-4.1-mini",
        }
      )
    ).rejects.toThrow();
  });
});

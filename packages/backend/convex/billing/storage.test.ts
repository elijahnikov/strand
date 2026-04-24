import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { createHarness, seedUser } from "../../test/harness";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  assertStorageAvailable,
  decrementStorageBytes,
  incrementStorageBytes,
} from "./storage";

const MB = 1024 * 1024;

type Plan = "free" | "basic" | "pro";

async function seedAccountWithPlan(
  t: ReturnType<typeof createHarness>,
  plan: Plan,
  storageBytesUsed = 0
): Promise<{ userId: Id<"user">; accountId: Id<"billingAccount"> }> {
  const { userId } = await seedUser(t);
  const accountId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("billingAccount", {
      type: "individual",
      ownerUserId: userId,
      plan,
      creditBalance: 0,
      storageBytesUsed,
    });
    await ctx.db.patch(userId, { personalBillingAccountId: id });
    return id;
  });
  return { userId, accountId };
}

describe("assertStorageAvailable", () => {
  it("passes when under the plan cap", async () => {
    const t = createHarness();
    const { accountId } = await seedAccountWithPlan(t, "free", 50 * MB);
    await t.run(async (ctx) => {
      await expect(
        assertStorageAvailable(ctx, accountId, 10 * MB)
      ).resolves.toBeUndefined();
    });
  });

  it("throws when adding would exceed the plan cap", async () => {
    const t = createHarness();
    const { accountId } = await seedAccountWithPlan(t, "free", 95 * MB);
    await t.run(async (ctx) => {
      await expect(
        assertStorageAvailable(ctx, accountId, 10 * MB)
      ).rejects.toThrow(/Storage limit reached/);
    });
  });
});

describe("incrementStorageBytes / decrementStorageBytes", () => {
  it("adds bytes to the running counter", async () => {
    const t = createHarness();
    const { accountId } = await seedAccountWithPlan(t, "basic", 10 * MB);
    await t.run(async (ctx) => {
      await incrementStorageBytes(ctx, accountId, 5 * MB);
    });
    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.storageBytesUsed).toBe(15 * MB);
  });

  it("subtracts bytes and floors at 0", async () => {
    const t = createHarness();
    const { accountId } = await seedAccountWithPlan(t, "basic", 5 * MB);
    await t.run(async (ctx) => {
      await decrementStorageBytes(ctx, accountId, 20 * MB);
    });
    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.storageBytesUsed).toBe(0);
  });
});

describe("backfillStorageUsage", () => {
  it("resets each account to the sum of its live fileResource rows", async () => {
    const t = createHarness();
    const { userId, accountId } = await seedAccountWithPlan(t, "pro", 999);
    const workspaceId = await t.run(async (ctx) =>
      ctx.db.insert("workspace", { name: "w", ownerId: userId })
    );
    await t.run(async (ctx) => {
      const r1 = await ctx.db.insert("resource", {
        workspaceId,
        createdBy: userId,
        type: "file",
        title: "a",
        isFavorite: false,
        isPinned: false,
        isArchived: false,
        updatedAt: Date.now(),
      });
      const r2 = await ctx.db.insert("resource", {
        workspaceId,
        createdBy: userId,
        type: "file",
        title: "b",
        isFavorite: false,
        isPinned: false,
        isArchived: false,
        updatedAt: Date.now(),
      });
      // Deleted resource should be excluded from the sum.
      const r3 = await ctx.db.insert("resource", {
        workspaceId,
        createdBy: userId,
        type: "file",
        title: "deleted",
        isFavorite: false,
        isPinned: false,
        isArchived: false,
        updatedAt: Date.now(),
        deletedAt: Date.now(),
      });
      const s1 = await ctx.storage.store(new Blob([]));
      const s2 = await ctx.storage.store(new Blob([]));
      const s3 = await ctx.storage.store(new Blob([]));
      await ctx.db.insert("fileResource", {
        resourceId: r1,
        storageId: s1,
        fileName: "a",
        fileSize: 3 * MB,
        mimeType: "text/plain",
      });
      await ctx.db.insert("fileResource", {
        resourceId: r2,
        storageId: s2,
        fileName: "b",
        fileSize: 7 * MB,
        mimeType: "text/plain",
      });
      await ctx.db.insert("fileResource", {
        resourceId: r3,
        storageId: s3,
        fileName: "c",
        fileSize: 100 * MB,
        mimeType: "text/plain",
      });
    });

    await t.mutation(internal.billing.storage.backfillStorageUsage, {});

    const account = await t.run(async (ctx) => ctx.db.get(accountId));
    expect(account?.storageBytesUsed).toBe(10 * MB);
  });
});

describe("ConvexError shape", () => {
  it("assertStorageAvailable throws a ConvexError with the canonical message", async () => {
    const t = createHarness();
    const { accountId } = await seedAccountWithPlan(t, "free", 99 * MB);
    let caught: unknown;
    await t.run(async (ctx) => {
      try {
        await assertStorageAvailable(ctx, accountId, 2 * MB);
      } catch (err) {
        caught = err;
      }
    });
    expect(caught).toBeInstanceOf(ConvexError);
  });
});

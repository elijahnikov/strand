import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { tierToAllotment } from "./pricing";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function createPersonalAccount(
  ctx: MutationCtx,
  userId: Id<"user">
): Promise<Id<"billingAccount">> {
  const accountId = await ctx.db.insert("billingAccount", {
    type: "individual",
    ownerUserId: userId,
    plan: "free",
    creditBalance: tierToAllotment("free"),
    creditResetAt: Date.now() + THIRTY_DAYS_MS,
  });
  await ctx.db.patch(userId, { personalBillingAccountId: accountId });
  return accountId;
}

/**
 * Called from the Better Auth `user.onCreate` trigger so every new user gets
 * a Free-tier billing account at signup. Idempotent — if the user already has
 * one (e.g. re-trigger after a crash), returns the existing id.
 */
export const createPersonalAccountForUser = internalMutation({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }
    if (user.personalBillingAccountId) {
      return user.personalBillingAccountId;
    }
    return await createPersonalAccount(ctx, args.userId);
  },
});

/**
 * One-shot backfill: creates a personal `billingAccount` row for every existing
 * user that doesn't have one, and stamps `user.personalBillingAccountId`.
 *
 * Safe to re-run — users that already have a personal account are skipped.
 * Run once after the schema migration lands, before any billing reads/writes
 * start depending on `personalBillingAccountId`.
 */
export const createPersonalAccountsForExistingUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    let created = 0;
    let skipped = 0;

    for (const user of users) {
      if (user.personalBillingAccountId) {
        skipped += 1;
        continue;
      }
      await createPersonalAccount(ctx, user._id);
      created += 1;
    }

    return { created, skipped, total: users.length };
  },
});

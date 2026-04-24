import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { tierToStorageBytes } from "./pricing";

export async function assertStorageAvailable(
  ctx: QueryCtx | MutationCtx,
  billingAccountId: Id<"billingAccount">,
  incomingBytes: number
): Promise<void> {
  const account = await ctx.db.get(billingAccountId);
  if (!account) {
    throw new ConvexError("Billing account not found");
  }
  const allotment = tierToStorageBytes(account.plan);
  const used = account.storageBytesUsed ?? 0;
  if (used + incomingBytes > allotment) {
    throw new ConvexError("Storage limit reached");
  }
}

export async function incrementStorageBytes(
  ctx: MutationCtx,
  billingAccountId: Id<"billingAccount">,
  bytes: number
): Promise<void> {
  if (bytes <= 0) {
    return;
  }
  const account = await ctx.db.get(billingAccountId);
  if (!account) {
    return;
  }
  await ctx.db.patch(billingAccountId, {
    storageBytesUsed: (account.storageBytesUsed ?? 0) + bytes,
  });
}

export async function decrementStorageBytes(
  ctx: MutationCtx,
  billingAccountId: Id<"billingAccount">,
  bytes: number
): Promise<void> {
  if (bytes <= 0) {
    return;
  }
  const account = await ctx.db.get(billingAccountId);
  if (!account) {
    return;
  }
  const next = Math.max(0, (account.storageBytesUsed ?? 0) - bytes);
  await ctx.db.patch(billingAccountId, { storageBytesUsed: next });
}

export const backfillStorageUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fileRows = await ctx.db.query("fileResource").collect();
    const totalsByAccount = new Map<Id<"billingAccount">, number>();

    for (const file of fileRows) {
      const resource = await ctx.db.get(file.resourceId);
      if (!resource || resource.deletedAt) {
        continue;
      }
      const user = await ctx.db.get(resource.createdBy);
      if (!user?.personalBillingAccountId) {
        continue;
      }
      const accountId = user.personalBillingAccountId;
      totalsByAccount.set(
        accountId,
        (totalsByAccount.get(accountId) ?? 0) + file.fileSize
      );
    }

    // Reset every billing account so ones with zero files get cleared too.
    const accounts = await ctx.db.query("billingAccount").collect();
    for (const account of accounts) {
      await ctx.db.patch(account._id, {
        storageBytesUsed: totalsByAccount.get(account._id) ?? 0,
      });
    }

    return {
      accountsUpdated: accounts.length,
      filesScanned: fileRows.length,
    };
  },
});

export const getStorageSummary = internalMutation({
  args: { billingAccountId: v.id("billingAccount") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.billingAccountId);
    if (!account) {
      return null;
    }
    return {
      used: account.storageBytesUsed ?? 0,
      allotment: tierToStorageBytes(account.plan),
    };
  },
});

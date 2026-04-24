import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

export type Plan = "free" | "basic" | "pro";

export interface ResolvedBillingAccount {
  billingAccountId: Id<"billingAccount">;
  creditBalance: number;
  plan: Plan;
}

export async function resolveActingBillingAccount(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"user">,
  _workspaceId?: Id<"workspace">
): Promise<ResolvedBillingAccount> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }
  if (!user.personalBillingAccountId) {
    throw new ConvexError(
      "User has no billing account — backfill must run before billing features are used"
    );
  }
  const account = await ctx.db.get(user.personalBillingAccountId);
  if (!account) {
    throw new ConvexError("Billing account not found");
  }
  return {
    billingAccountId: account._id,
    plan: account.plan,
    creditBalance: account.creditBalance,
  };
}

export const resolveActing = internalQuery({
  args: {
    userId: v.id("user"),
    workspaceId: v.optional(v.id("workspace")),
  },
  handler: (ctx, args) =>
    resolveActingBillingAccount(ctx, args.userId, args.workspaceId),
});

export const resolveActingByResource = internalQuery({
  args: { resourceId: v.id("resource") },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) {
      throw new ConvexError("Resource not found");
    }
    const resolved = await resolveActingBillingAccount(
      ctx,
      resource.createdBy,
      resource.workspaceId
    );
    return {
      ...resolved,
      actingUserId: resource.createdBy,
      workspaceId: resource.workspaceId,
    };
  },
});

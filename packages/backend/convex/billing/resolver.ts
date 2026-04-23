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

/**
 * Single place that answers: "for this user acting in this workspace,
 * which billingAccount pays and which plan gates?"
 *
 * Today: always returns the user's personal billingAccount.
 * When teams arrive: this function is the ONLY place that changes — it will
 * return the team's billingAccount when the workspace is team-owned and the
 * user is a member. Every debit + gate reads through here, so no callsite
 * needs to change.
 */
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

/** Action-callable wrapper — actions hit this via ctx.runQuery. */
export const resolveActing = internalQuery({
  args: {
    userId: v.id("user"),
    workspaceId: v.optional(v.id("workspace")),
  },
  handler: (ctx, args) =>
    resolveActingBillingAccount(ctx, args.userId, args.workspaceId),
});

/**
 * Resolve the billing account that pays for work triggered by a resource —
 * the resource's creator. Used by background AI actions (enrichment, chunking,
 * link generation) that don't have a user in scope but do have the resource.
 */
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

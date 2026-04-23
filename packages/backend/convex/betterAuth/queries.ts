import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Resolve a Better Auth component user `_id` to our app's `user._id`.
 *
 * Better Auth's subscription rows store `referenceId`, which is the component
 * user's `_id` — not our app user id. The `userId` column on the component's
 * user row holds our app `user._id` as a string (set by `setUserId` in the
 * `onCreate` trigger). This query is the bridge.
 */
export const getAppUserId = query({
  args: { authId: v.id("user") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.authId);
    return doc?.userId ?? null;
  },
});

/**
 * Reverse lookup: given our app `user._id` (as a string), find the Better
 * Auth component user `_id`. Used by repair tooling to walk the component's
 * subscription table for an app user.
 */
export const getAuthIdForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("user")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .take(1);
    return rows.at(0)?._id ?? null;
  },
});

/**
 * Find the most recent active-or-trialing subscription row for a Better Auth
 * user (keyed by `referenceId`). Returns null if none — used to repair
 * `billingAccount` state when the sync hook missed an event.
 */
export const getLatestSubscriptionForReference = query({
  args: { referenceId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("subscription").collect();
    const matches = rows.filter((r) => r.referenceId === args.referenceId);
    const active = matches.find(
      (r) => r.status === "active" || r.status === "trialing"
    );
    return active ?? null;
  },
});

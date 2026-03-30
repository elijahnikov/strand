import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { authComponent } from "../auth";

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser?.userId) {
      return null;
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user", (q) =>
        q.eq("userId", authUser.userId as Id<"user">)
      )
      .first();

    if (!member) {
      return null;
    }

    return ctx.db.get(member.workspaceId);
  },
});

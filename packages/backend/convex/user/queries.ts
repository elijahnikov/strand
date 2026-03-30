import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { authComponent } from "../auth";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    if (!authUser) {
      return {
        user: null,
      };
    }

    const user = await ctx.db.get(authUser.userId as Id<"user">);

    return {
      user,
    };
  },
});

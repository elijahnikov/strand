import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getAuthIdentity } from "../utils";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      return { user: null };
    }
    const user = await ctx.db.get(identity.userId as Id<"user">);
    return { user };
  },
});

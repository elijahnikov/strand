import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthIdentity } from "../utils";

export const generateImportUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

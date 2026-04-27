import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { protectedAction } from "../utils";

export const exportData = protectedAction({
  args: {},
  handler: async (ctx): Promise<{ url: string; exportedAt: number }> => {
    const data = await ctx.runQuery(internal.user.internals.gatherExportData);

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new ConvexError("Could not produce export download URL");
    }
    return { url, exportedAt: data.exportedAt };
  },
});

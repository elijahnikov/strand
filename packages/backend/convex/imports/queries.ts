import { ConvexError, v } from "convex/values";
import { workspaceQuery } from "../utils";

export const listImports = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("importJob")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .order("desc")
      .take(50);
  },
});

export const getImport = workspaceQuery({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Import not found");
    }
    return job;
  },
});

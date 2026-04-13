import { workspaceQuery } from "../utils";

export const getMyMemory = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("userMemory")
      .withIndex("by_user_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id)
      )
      .first();

    if (!row) {
      return null;
    }

    return {
      content: row.content,
      status: row.status,
      lastExtractedAt: row.lastExtractedAt,
      lastManualEditAt: row.lastManualEditAt,
      updatedAt: row.updatedAt,
    };
  },
});

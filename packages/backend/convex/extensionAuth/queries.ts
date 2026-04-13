import { protectedQuery } from "../utils";

export const listMyExtensionTokens = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("extensionToken")
      .withIndex("by_user", (q) =>
        q.eq("userId", ctx.user._id).eq("revokedAt", undefined)
      )
      .collect();

    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        _id: row._id,
        label: row.label,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
      }));
  },
});

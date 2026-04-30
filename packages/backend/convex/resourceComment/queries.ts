import { ConvexError, v } from "convex/values";
import { workspaceQuery } from "../utils";

export const list = workspaceQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const comments = await ctx.db
      .query("resourceComment")
      .withIndex("by_resource", (q) =>
        q.eq("resourceId", args.resourceId).eq("deletedAt", undefined)
      )
      .order("asc")
      .collect();

    return await Promise.all(
      comments.map(async (c) => {
        const author = await ctx.db.get(c.authorId);
        return {
          ...c,
          author: author
            ? {
                _id: author._id,
                username: author.username,
                image: author.image,
              }
            : null,
        };
      })
    );
  },
});

export const getUnreadInfo = workspaceQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      return { hasUnread: false, latestAt: null as number | null };
    }

    const latest = await ctx.db
      .query("resourceComment")
      .withIndex("by_resource", (q) =>
        q.eq("resourceId", args.resourceId).eq("deletedAt", undefined)
      )
      .order("desc")
      .first();

    if (!latest) {
      return { hasUnread: false, latestAt: null as number | null };
    }

    const readRow = await ctx.db
      .query("resourceCommentRead")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", ctx.user._id).eq("resourceId", args.resourceId)
      )
      .unique();

    const lastSeenAt = readRow?.lastSeenAt ?? 0;
    const hasUnread =
      latest.authorId !== ctx.user._id && latest.createdAt > lastSeenAt;

    return { hasUnread, latestAt: latest.createdAt };
  },
});

import { v } from "convex/values";
import { workspaceQuery } from "../utils";

export const get = workspaceQuery({
  args: { collectionId: v.id("collection") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (
      !collection ||
      collection.workspaceId !== ctx.workspace._id ||
      collection.deletedAt
    ) {
      return null;
    }

    // Walk up parentId chain to build breadcrumbs
    const breadcrumbs: Array<{ _id: typeof collection._id; name: string }> = [];
    let current = collection;
    while (current.parentId) {
      const parent = await ctx.db.get(current.parentId);
      if (!parent || parent.deletedAt) {
        break;
      }
      breadcrumbs.unshift({ _id: parent._id, name: parent.name });
      current = parent;
    }

    return {
      _id: collection._id,
      name: collection.name,
      icon: collection.icon,
      parentId: collection.parentId,
      createdBy: collection.createdBy,
      _creationTime: collection._creationTime,
      updatedAt: collection.updatedAt,
      breadcrumbs,
    };
  },
});

export const listChildren = workspaceQuery({
  args: { parentId: v.optional(v.id("collection")) },
  handler: (ctx, args) => {
    return ctx.db
      .query("collection")
      .withIndex("by_workspace_parent", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("parentId", args.parentId)
          .eq("deletedAt", undefined)
      )
      .collect();
  },
});

export const listAll = workspaceQuery({
  args: {},
  handler: (ctx) => {
    return ctx.db
      .query("collection")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("deletedAt", undefined)
      )
      .collect();
  },
});

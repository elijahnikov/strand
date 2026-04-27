import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";

export const gatherExportData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject as Id<"user">;
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const memberships = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (member) => {
        const workspace = await ctx.db.get(member.workspaceId);
        if (!workspace) {
          return null;
        }

        const resources = await ctx.db
          .query("resource")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", workspace._id).eq("deletedAt", undefined)
          )
          .collect();

        const collections = await ctx.db
          .query("collection")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", workspace._id).eq("deletedAt", undefined)
          )
          .collect();

        const tags = await ctx.db
          .query("tag")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
          .collect();

        return {
          id: workspace._id,
          name: workspace.name,
          role: member.role,
          ownerId: workspace.ownerId,
          createdAt: workspace._creationTime,
          resources: resources.map((r) => ({
            id: r._id,
            type: r.type,
            title: r.title,
            collectionId: r.collectionId,
            isFavorite: r.isFavorite,
            isPinned: r.isPinned,
            isArchived: r.isArchived,
            createdAt: r._creationTime,
            updatedAt: r.updatedAt,
          })),
          collections: collections.map((c) => ({
            id: c._id,
            name: c.name,
            parentId: c.parentId,
            createdAt: c._creationTime,
          })),
          tags: tags.map((t) => ({
            id: t._id,
            name: t.name,
            createdAt: t._creationTime,
          })),
        };
      })
    );

    return {
      exportedAt: Date.now(),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user._creationTime,
      },
      workspaces: workspaces.filter((w) => w !== null),
    };
  },
});

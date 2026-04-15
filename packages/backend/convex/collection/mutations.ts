import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { workspaceMutation } from "../utils";

export const create = workspaceMutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("collection")),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (
        !parent ||
        parent.workspaceId !== ctx.workspace._id ||
        parent.deletedAt
      ) {
        throw new ConvexError("Parent collection not found");
      }
    }

    return ctx.db.insert("collection", {
      workspaceId: ctx.workspace._id,
      parentId: args.parentId,
      name: args.name,
      icon: args.icon,
      createdBy: ctx.user._id,
      updatedAt: Date.now(),
    });
  },
});

export const rename = workspaceMutation({
  args: {
    collectionId: v.id("collection"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Collection not found");
    }
    await ctx.db.patch(args.collectionId, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

export const updateIcon = workspaceMutation({
  args: {
    collectionId: v.id("collection"),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Collection not found");
    }
    await ctx.db.patch(args.collectionId, {
      icon: args.icon,
      updatedAt: Date.now(),
    });
  },
});

export const move = workspaceMutation({
  args: {
    collectionId: v.id("collection"),
    newParentId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Collection not found");
    }

    // Validate no circular reference
    if (args.newParentId) {
      let current = await ctx.db.get(args.newParentId);
      while (current) {
        if (current._id === args.collectionId) {
          throw new ConvexError(
            "Cannot move a collection into one of its descendants"
          );
        }
        if (!current.parentId) {
          break;
        }
        current = await ctx.db.get(current.parentId);
      }
    }

    await ctx.db.patch(args.collectionId, {
      parentId: args.newParentId,
      updatedAt: Date.now(),
    });
  },
});

export const remove = workspaceMutation({
  args: { collectionId: v.id("collection") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Collection not found");
    }

    const now = Date.now();

    // Move contained resources to root
    const resources = await ctx.db
      .query("resource")
      .withIndex("by_workspace_collection", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("collectionId", args.collectionId)
          .eq("deletedAt", undefined)
      )
      .collect();

    for (const resource of resources) {
      await ctx.db.patch(resource._id, { collectionId: undefined });
    }

    // Cascade soft-delete to child collections
    const softDeleteChildren = async (parentId: typeof args.collectionId) => {
      const children = await ctx.db
        .query("collection")
        .withIndex("by_workspace_parent", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("parentId", parentId)
            .eq("deletedAt", undefined)
        )
        .collect();

      for (const child of children) {
        // Move child's resources to root
        const childResources = await ctx.db
          .query("resource")
          .withIndex("by_workspace_collection", (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .eq("collectionId", child._id)
              .eq("deletedAt", undefined)
          )
          .collect();

        for (const resource of childResources) {
          await ctx.db.patch(resource._id, { collectionId: undefined });
        }

        await ctx.db.patch(child._id, { deletedAt: now });
        await softDeleteChildren(child._id);
      }
    };

    await softDeleteChildren(args.collectionId);
    await ctx.db.patch(args.collectionId, { deletedAt: now });
  },
});

export const moveMany = workspaceMutation({
  args: {
    collectionIds: v.array(v.id("collection")),
    newParentId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    if (args.newParentId) {
      const parent = await ctx.db.get(args.newParentId);
      if (
        !parent ||
        parent.workspaceId !== ctx.workspace._id ||
        parent.deletedAt
      ) {
        throw new ConvexError("Parent collection not found");
      }
    }

    const now = Date.now();
    const selectedSet = new Set(args.collectionIds);

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection || collection.workspaceId !== ctx.workspace._id) {
        continue;
      }
      if (args.newParentId === collectionId) {
        continue;
      }

      if (args.newParentId) {
        let circular = false;
        let current = await ctx.db.get(args.newParentId);
        while (current) {
          if (current._id === collectionId) {
            circular = true;
            break;
          }
          if (selectedSet.has(current._id)) {
            circular = true;
            break;
          }
          if (!current.parentId) {
            break;
          }
          current = await ctx.db.get(current.parentId);
        }
        if (circular) {
          continue;
        }
      }

      await ctx.db.patch(collectionId, {
        parentId: args.newParentId,
        updatedAt: now,
      });
    }
  },
});

export const removeMany = workspaceMutation({
  args: {
    collectionIds: v.array(v.id("collection")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const softDeleteChildren = async (parentId: Id<"collection">) => {
      const children = await ctx.db
        .query("collection")
        .withIndex("by_workspace_parent", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("parentId", parentId)
            .eq("deletedAt", undefined)
        )
        .collect();

      for (const child of children) {
        const childResources = await ctx.db
          .query("resource")
          .withIndex("by_workspace_collection", (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .eq("collectionId", child._id)
              .eq("deletedAt", undefined)
          )
          .collect();

        for (const resource of childResources) {
          await ctx.db.patch(resource._id, { collectionId: undefined });
        }

        await ctx.db.patch(child._id, { deletedAt: now });
        await softDeleteChildren(child._id);
      }
    };

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection || collection.workspaceId !== ctx.workspace._id) {
        continue;
      }
      if (collection.deletedAt) {
        continue;
      }

      const resources = await ctx.db
        .query("resource")
        .withIndex("by_workspace_collection", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("collectionId", collectionId)
            .eq("deletedAt", undefined)
        )
        .collect();
      for (const resource of resources) {
        await ctx.db.patch(resource._id, { collectionId: undefined });
      }

      await softDeleteChildren(collectionId);
      await ctx.db.patch(collectionId, { deletedAt: now });
    }
  },
});

export const createWithResources = workspaceMutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    const collectionId = await ctx.db.insert("collection", {
      workspaceId: ctx.workspace._id,
      name: trimmed.length > 0 ? trimmed : "Untitled collection",
      icon: args.icon,
      createdBy: ctx.user._id,
      updatedAt: Date.now(),
    });

    let movedCount = 0;
    for (const resourceId of args.resourceIds) {
      const resource = await ctx.db.get(resourceId);
      if (
        !resource ||
        resource.workspaceId !== ctx.workspace._id ||
        resource.deletedAt
      ) {
        continue;
      }
      await ctx.db.patch(resourceId, {
        collectionId,
        updatedAt: Date.now(),
      });
      movedCount += 1;
    }

    return { collectionId, movedCount };
  },
});

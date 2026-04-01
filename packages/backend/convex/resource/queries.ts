import { v } from "convex/values";
import { workspaceQuery } from "../utils";

export const get = workspaceQuery({
  args: { resourceId: v.id("resource") },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      return null;
    }

    const resourceAI = await ctx.db
      .query("resourceAI")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .unique();

    switch (resource.type) {
      case "website": {
        const website = await ctx.db
          .query("websiteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        return { ...resource, website, aiStatus: resourceAI?.status };
      }
      case "note": {
        const note = await ctx.db
          .query("noteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        return { ...resource, note, aiStatus: resourceAI?.status };
      }
      case "file": {
        const file = await ctx.db
          .query("fileResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        const fileUrl =
          file?.mimeType?.startsWith("image/") && file.storageId
            ? await ctx.storage.getUrl(file.storageId)
            : null;
        return { ...resource, file, fileUrl, aiStatus: resourceAI?.status };
      }
      default:
        return { ...resource, aiStatus: resourceAI?.status };
    }
  },
});

export const list = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const resources = await ctx.db
      .query("resource")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("deletedAt", undefined)
      )
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      resources.map(async (resource) => {
        const resourceAI = await ctx.db
          .query("resourceAI")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();

        switch (resource.type) {
          case "website": {
            const website = await ctx.db
              .query("websiteResource")
              .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
              .unique();
            return { ...resource, website, aiStatus: resourceAI?.status };
          }
          case "note": {
            const note = await ctx.db
              .query("noteResource")
              .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
              .unique();
            return { ...resource, note, aiStatus: resourceAI?.status };
          }
          case "file": {
            const file = await ctx.db
              .query("fileResource")
              .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
              .unique();
            const fileUrl =
              file?.mimeType?.startsWith("image/") && file.storageId
                ? await ctx.storage.getUrl(file.storageId)
                : null;
            return { ...resource, file, fileUrl, aiStatus: resourceAI?.status };
          }
          default:
            return { ...resource, aiStatus: resourceAI?.status };
        }
      })
    );

    return enriched;
  },
});

import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const updateWebsiteMetadata = internalMutation({
  args: {
    resourceId: v.id("resource"),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    siteName: v.optional(v.string()),
    favicon: v.optional(v.string()),
    isEmbeddable: v.optional(v.boolean()),
    embedType: v.optional(
      v.union(
        v.literal("youtube"),
        v.literal("tweet"),
        v.literal("reddit"),
        v.literal("spotify"),
        v.literal("github_gist"),
        v.literal("codepen")
      )
    ),
    embedId: v.optional(v.string()),
    metadataStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    metadataError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const websiteResource = await ctx.db
      .query("websiteResource")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    if (!websiteResource) {
      throw new ConvexError("Website resource not found");
    }

    await ctx.db.patch(websiteResource._id, {
      ogTitle: args.ogTitle,
      ogDescription: args.ogDescription,
      ogImage: args.ogImage,
      siteName: args.siteName,
      favicon: args.favicon,
      isEmbeddable: args.isEmbeddable ?? false,
      embedType: args.embedType,
      embedId: args.embedId,
      metadataStatus: args.metadataStatus,
      metadataError: args.metadataError,
    });

    // Update resource title if we got an OG title
    if (args.ogTitle) {
      await ctx.db.patch(args.resourceId, {
        title: args.ogTitle,
        description: args.ogDescription,
        updatedAt: Date.now(),
      });
    }
  },
});

export const setWebsiteMetadataStatus = internalMutation({
  args: {
    resourceId: v.id("resource"),
    metadataStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    metadataError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const websiteResource = await ctx.db
      .query("websiteResource")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    if (!websiteResource) {
      throw new ConvexError("Website resource not found");
    }

    await ctx.db.patch(websiteResource._id, {
      metadataStatus: args.metadataStatus,
      metadataError: args.metadataError,
    });
  },
});

export const getWebsiteResource = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("websiteResource")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();
  },
});

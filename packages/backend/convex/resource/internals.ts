import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { createResource } from "./mutations";

export const createForUser = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    type: v.union(v.literal("website"), v.literal("note"), v.literal("file")),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    jsonContent: v.optional(v.string()),
    plainTextContent: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    collectionId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    return await createResource(ctx, args);
  },
});

export const generateUploadUrlInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

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
        v.literal("codepen"),
        v.literal("vimeo"),
        v.literal("loom"),
        v.literal("figma"),
        v.literal("codesandbox"),
        v.literal("bluesky"),
        v.literal("soundcloud"),
        v.literal("google_docs"),
        v.literal("google_sheets"),
        v.literal("google_slides"),
        v.literal("notion")
      )
    ),
    embedId: v.optional(v.string()),
    articleContent: v.optional(v.string()),
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
      articleContent: args.articleContent,
      metadataStatus: args.metadataStatus,
      metadataError: args.metadataError,
    });

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

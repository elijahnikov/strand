import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const getResourceContent = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) {
      throw new ConvexError("Resource not found");
    }

    switch (resource.type) {
      case "website": {
        const website = await ctx.db
          .query("websiteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
          .unique();
        return {
          type: "website" as const,
          title: resource.title,
          description: resource.description,
          workspaceId: resource.workspaceId,
          articleContent: website?.articleContent,
          url: website?.url,
          ogDescription: website?.ogDescription,
        };
      }
      case "note": {
        const note = await ctx.db
          .query("noteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
          .unique();
        return {
          type: "note" as const,
          title: resource.title,
          description: resource.description,
          workspaceId: resource.workspaceId,
          plainTextContent: note?.plainTextContent,
        };
      }
      case "file": {
        const file = await ctx.db
          .query("fileResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
          .unique();
        let fileUrl: string | null = null;
        if (file) {
          fileUrl = await ctx.storage.getUrl(file.storageId);
        }
        return {
          type: "file" as const,
          title: resource.title,
          description: resource.description,
          workspaceId: resource.workspaceId,
          fileName: file?.fileName,
          mimeType: file?.mimeType,
          fileUrl,
        };
      }
      default:
        throw new ConvexError(
          `Unknown resource type: ${String(resource.type)}`
        );
    }
  },
});

export const setResourceAIStatus = internalMutation({
  args: {
    resourceId: v.id("resource"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resourceAI = await ctx.db
      .query("resourceAI")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    if (!resourceAI) {
      throw new ConvexError("ResourceAI not found");
    }

    await ctx.db.patch(resourceAI._id, {
      status: args.status,
      error: args.error,
      ...(args.status === "completed" ? { processedAt: Date.now() } : {}),
    });
  },
});

export const updateResourceAI = internalMutation({
  args: {
    resourceId: v.id("resource"),
    summary: v.string(),
    tags: v.array(v.string()),
    extractedEntities: v.array(v.string()),
    sentiment: v.string(),
    language: v.string(),
    category: v.string(),
    keyQuotes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const resourceAI = await ctx.db
      .query("resourceAI")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    if (!resourceAI) {
      throw new ConvexError("ResourceAI not found");
    }

    await ctx.db.patch(resourceAI._id, {
      summary: args.summary,
      tags: args.tags,
      extractedEntities: args.extractedEntities,
      sentiment: args.sentiment,
      language: args.language,
      category: args.category,
      keyQuotes: args.keyQuotes,
      status: "completed",
      processedAt: Date.now(),
    });
  },
});

export const upsertResourceEmbedding = internalMutation({
  args: {
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    embedding: v.array(v.float64()),
    model: v.string(),
    inputHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("resourceEmbedding")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    if (existing) {
      if (existing.inputHash === args.inputHash) {
        return;
      }
      await ctx.db.patch(existing._id, {
        embedding: args.embedding,
        model: args.model,
        inputHash: args.inputHash,
      });
    } else {
      await ctx.db.insert("resourceEmbedding", {
        resourceId: args.resourceId,
        workspaceId: args.workspaceId,
        embedding: args.embedding,
        model: args.model,
        inputHash: args.inputHash,
      });
    }
  },
});

export const getResourceEmbedding = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("resourceEmbedding")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();
  },
});

export const getResourceById = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.deletedAt) {
      return null;
    }
    return resource;
  },
});

export const getTagById = internalQuery({
  args: {
    tagId: v.id("tag"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tagId);
  },
});

export const getTagByName = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tag")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.tagName)
      )
      .unique();
  },
});

export const enrichResourceById = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.deletedAt) {
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

export const getEmbeddingById = internalQuery({
  args: {
    embeddingId: v.id("resourceEmbedding"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.embeddingId);
  },
});

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { workspaceMutation } from "../utils";

export const create = workspaceMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const resourceId = await ctx.db.insert("resource", {
      workspaceId: ctx.workspace._id,
      createdBy: ctx.user._id,
      type: args.type,
      title: args.title,
      description: args.description,
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      updatedAt: now,
    });

    switch (args.type) {
      case "website":
        await insertWebsiteResource(ctx, resourceId, args);
        break;
      case "note":
        await insertNoteResource(ctx, resourceId, args);
        break;
      case "file":
        await insertFileResource(ctx, resourceId, args);
        break;
      default:
        throw new ConvexError(
          `Could not insert resource on type ${String(args.type)}`
        );
    }

    await ctx.db.insert("resourceAI", {
      resourceId,
      workspaceId: ctx.workspace._id,
      status: "pending",
    });

    if (args.type === "website") {
      await ctx.scheduler.runAfter(
        0,
        internal.resource.actions.extractWebsiteMetadata,
        { resourceId }
      );
    }

    if (args.type === "note" || args.type === "file") {
      await ctx.scheduler.runAfter(
        0,
        internal.resource.aiActions.processResourceAI,
        { resourceId }
      );
    }

    return resourceId;
  },
});

async function insertWebsiteResource(
  ctx: MutationCtx,
  resourceId: Id<"resource">,
  args: { url?: string }
) {
  if (!args.url) {
    throw new ConvexError("URL is required for website resources");
  }

  let domain: string | undefined;
  try {
    domain = new URL(args.url).hostname;
  } catch {
    // invalid URL, skip domain extraction
  }

  await ctx.db.insert("websiteResource", {
    resourceId,
    url: args.url,
    domain,
    isEmbeddable: false,
    metadataStatus: "pending",
  });
}

async function insertNoteResource(
  ctx: MutationCtx,
  resourceId: Id<"resource">,
  args: {
    htmlContent?: string;
    jsonContent?: string;
    plainTextContent?: string;
  }
) {
  await ctx.db.insert("noteResource", {
    resourceId,
    htmlContent: args.htmlContent,
    jsonContent: args.jsonContent,
    plainTextContent: args.plainTextContent,
  });
}

async function insertFileResource(
  ctx: MutationCtx,
  resourceId: Id<"resource">,
  args: {
    storageId?: Id<"_storage">;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
  }
) {
  if (!(args.storageId && args.fileName && args.fileSize && args.mimeType)) {
    throw new ConvexError(
      "storageId, fileName, fileSize, and mimeType are required for file resources"
    );
  }

  await ctx.db.insert("fileResource", {
    resourceId,
    storageId: args.storageId,
    fileName: args.fileName,
    fileSize: args.fileSize,
    mimeType: args.mimeType,
    width: args.width,
    height: args.height,
    duration: args.duration,
  });
}

export const updateTitle = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }
    await ctx.db.patch(args.resourceId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const togglePin = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const existing = await ctx.db
      .query("userResourcePin")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", ctx.user._id).eq("resourceId", args.resourceId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { pinned: false };
    }

    await ctx.db.insert("userResourcePin", {
      userId: ctx.user._id,
      resourceId: args.resourceId,
      workspaceId: ctx.workspace._id,
      pinnedAt: Date.now(),
    });
    return { pinned: true };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const pinLink = workspaceMutation({
  args: {
    sourceResourceId: v.id("resource"),
    targetResourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceResourceId);
    const target = await ctx.db.get(args.targetResourceId);
    if (
      !(source && target) ||
      source.workspaceId !== ctx.workspace._id ||
      target.workspaceId !== ctx.workspace._id
    ) {
      throw new ConvexError("Resource not found");
    }

    const existingForward = await ctx.db
      .query("resourceLink")
      .withIndex("by_source_target", (q) =>
        q
          .eq("sourceResourceId", args.sourceResourceId)
          .eq("targetResourceId", args.targetResourceId)
      )
      .unique();

    const existingReverse = await ctx.db
      .query("resourceLink")
      .withIndex("by_source_target", (q) =>
        q
          .eq("sourceResourceId", args.targetResourceId)
          .eq("targetResourceId", args.sourceResourceId)
      )
      .unique();

    const existing = existingForward ?? existingReverse;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pinned",
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("resourceLink", {
      workspaceId: ctx.workspace._id,
      sourceResourceId: args.sourceResourceId,
      targetResourceId: args.targetResourceId,
      score: 1.0,
      conceptOverlap: 0,
      semanticSimilarity: 0,
      sharedConcepts: [],
      status: "pinned",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const unpinLink = workspaceMutation({
  args: { linkId: v.id("resourceLink") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link || link.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Link not found");
    }
    await ctx.db.delete(args.linkId);
  },
});

export const addTag = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const normalized = args.name.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new ConvexError("Tag name cannot be empty");
    }

    let tag = await ctx.db
      .query("tag")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("name", normalized)
      )
      .unique();

    if (!tag) {
      const tagId = await ctx.db.insert("tag", {
        workspaceId: ctx.workspace._id,
        name: normalized,
      });
      tag = await ctx.db.get(tagId);

      await ctx.scheduler.runAfter(
        0,
        internal.resource.aiActions.generateTagEmbedding,
        {
          workspaceId: ctx.workspace._id,
          tagName: normalized,
        }
      );
    }

    if (!tag) {
      throw new ConvexError("Failed to create tag");
    }

    const existing = await ctx.db
      .query("resourceTag")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) => q.eq(q.field("tagId"), tag._id))
      .unique();

    if (existing) {
      return tag._id;
    }

    await ctx.db.insert("resourceTag", {
      resourceId: args.resourceId,
      tagId: tag._id,
      workspaceId: ctx.workspace._id,
    });

    return tag._id;
  },
});

export const removeTag = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    tagId: v.id("tag"),
  },
  handler: async (ctx, args) => {
    const junction = await ctx.db
      .query("resourceTag")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) => q.eq(q.field("tagId"), args.tagId))
      .unique();

    if (junction) {
      await ctx.db.delete(junction._id);
    }
  },
});

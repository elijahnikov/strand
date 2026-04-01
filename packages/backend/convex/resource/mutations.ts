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

    // Website fields
    url: v.optional(v.string()),

    // Note fields
    htmlContent: v.optional(v.string()),
    jsonContent: v.optional(v.string()),
    plainTextContent: v.optional(v.string()),

    // File fields
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

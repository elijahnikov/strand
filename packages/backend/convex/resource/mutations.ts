import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveActingBillingAccount } from "../billing/resolver";
import {
  assertStorageAvailable,
  decrementStorageBytes,
  incrementStorageBytes,
} from "../billing/storage";
import { protectedMutation, workspaceMutation } from "../utils";

export interface CreateResourceArgs {
  collectionId?: Id<"collection">;
  description?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  height?: number;
  htmlContent?: string;
  jsonContent?: string;
  mimeType?: string;
  plainTextContent?: string;
  storageId?: Id<"_storage">;
  title: string;
  type: "website" | "note" | "file";
  url?: string;
  userId: Id<"user">;
  width?: number;
  workspaceId: Id<"workspace">;
}

export async function createResource(
  ctx: MutationCtx,
  args: CreateResourceArgs
): Promise<Id<"resource">> {
  const now = Date.now();

  if (args.collectionId) {
    const collection = await ctx.db.get(args.collectionId);
    if (
      !collection ||
      collection.workspaceId !== args.workspaceId ||
      collection.deletedAt
    ) {
      throw new ConvexError("Collection not found");
    }
  }

  const resourceId = await ctx.db.insert("resource", {
    workspaceId: args.workspaceId,
    createdBy: args.userId,
    type: args.type,
    title: args.title,
    description: args.description,
    collectionId: args.collectionId,
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
      await insertFileResource(ctx, resourceId, args.userId, args);
      break;
    default:
      throw new ConvexError(
        `Could not insert resource on type ${String(args.type)}`
      );
  }

  await ctx.db.insert("resourceAI", {
    resourceId,
    workspaceId: args.workspaceId,
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
}

export interface CreateResourceForImportArgs extends CreateResourceArgs {
  createdAt?: number;
  importedFrom: string;
  isArchived?: boolean;
  isFavorite?: boolean;
}

export async function createResourceForImport(
  ctx: MutationCtx,
  args: CreateResourceForImportArgs
): Promise<Id<"resource">> {
  if (args.collectionId) {
    const collection = await ctx.db.get(args.collectionId);
    if (
      !collection ||
      collection.workspaceId !== args.workspaceId ||
      collection.deletedAt
    ) {
      throw new ConvexError("Collection not found");
    }
  }

  const now = args.createdAt ?? Date.now();

  const resourceId = await ctx.db.insert("resource", {
    workspaceId: args.workspaceId,
    createdBy: args.userId,
    type: args.type,
    title: args.title,
    description: args.description,
    collectionId: args.collectionId,
    isFavorite: args.isFavorite ?? false,
    isPinned: false,
    isArchived: args.isArchived ?? false,
    updatedAt: now,
    importedFrom: args.importedFrom,
  });

  switch (args.type) {
    case "website":
      await insertWebsiteResource(ctx, resourceId, args);
      break;
    case "note":
      await insertNoteResource(ctx, resourceId, args);
      break;
    case "file":
      await insertFileResource(ctx, resourceId, args.userId, args);
      break;
    default:
      throw new ConvexError(
        `Could not insert resource on type ${String(args.type)}`
      );
  }

  await ctx.db.insert("resourceAI", {
    resourceId,
    workspaceId: args.workspaceId,
    status: "skipped",
  });

  return resourceId;
}

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

    collectionId: v.optional(v.id("collection")),
  },
  rateLimit: "aiResourceProcess",
  handler: async (ctx, args) => {
    return await createResource(ctx, {
      ...args,
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
    });
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
  userId: Id<"user">,
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

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (args.fileSize > MAX_FILE_SIZE) {
    throw new ConvexError("File size exceeds the 50MB limit");
  }

  const resolved = await resolveActingBillingAccount(ctx, userId);
  await assertStorageAvailable(ctx, resolved.billingAccountId, args.fileSize);

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

  await incrementStorageBytes(ctx, resolved.billingAccountId, args.fileSize);
}

const UPDATED_AT_THROTTLE_MS = 60_000;

export const updateContent = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    htmlContent: v.optional(v.string()),
    jsonContent: v.optional(v.string()),
    plainTextContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const existing = await ctx.db
      .query("resourceContent")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();

    const patch = {
      htmlContent: args.htmlContent,
      jsonContent: args.jsonContent,
      plainTextContent: args.plainTextContent,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("resourceContent", {
        resourceId: args.resourceId,
        ...patch,
      });
    }

    const now = Date.now();
    if (now - resource.updatedAt > UPDATED_AT_THROTTLE_MS) {
      await ctx.db.patch(args.resourceId, { updatedAt: now });
    }
  },
});

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

export const generateUploadUrl = protectedMutation({
  args: {},
  rateLimit: "resourceUpload",
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

export const moveToCollection = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    collectionId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    if (args.collectionId) {
      const collection = await ctx.db.get(args.collectionId);
      if (
        !collection ||
        collection.workspaceId !== ctx.workspace._id ||
        collection.deletedAt
      ) {
        throw new ConvexError("Collection not found");
      }
    }

    await ctx.db.patch(args.resourceId, {
      collectionId: args.collectionId,
      updatedAt: Date.now(),
    });
  },
});

export const removeMany = workspaceMutation({
  args: {
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const resourceId of args.resourceIds) {
      const resource = await ctx.db.get(resourceId);
      if (!resource || resource.workspaceId !== ctx.workspace._id) {
        continue;
      }
      if (resource.deletedAt) {
        continue;
      }
      await ctx.db.patch(resourceId, { deletedAt: now });
    }
  },
});

async function deleteDerivedArtifacts(
  ctx: MutationCtx,
  resourceId: Id<"resource">,
  createdBy: Id<"user">
) {
  const embeddings = await ctx.db
    .query("resourceEmbedding")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();
  for (const embedding of embeddings) {
    await ctx.db.delete(embedding._id);
  }

  const chunks = await ctx.db
    .query("resourceChunk")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();
  for (const chunk of chunks) {
    await ctx.db.delete(chunk._id);
  }

  const conceptLinks = await ctx.db
    .query("resourceConcept")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();
  for (const link of conceptLinks) {
    await ctx.db.delete(link._id);
  }

  const fileRow = await ctx.db
    .query("fileResource")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .unique();
  if (fileRow) {
    const owner = await ctx.db.get(createdBy);
    if (owner?.personalBillingAccountId) {
      await decrementStorageBytes(
        ctx,
        owner.personalBillingAccountId,
        fileRow.fileSize
      );
    }
    if (fileRow.storageId) {
      await ctx.storage.delete(fileRow.storageId);
    }
    await ctx.db.delete(fileRow._id);
  }
}

export const restoreMany = workspaceMutation({
  args: {
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    for (const resourceId of args.resourceIds) {
      const resource = await ctx.db.get(resourceId);
      if (!resource || resource.workspaceId !== ctx.workspace._id) {
        continue;
      }
      if (!resource.deletedAt) {
        continue;
      }
      await ctx.db.patch(resourceId, { deletedAt: undefined });
    }
  },
});

async function purgeResource(
  ctx: MutationCtx,
  resourceId: Id<"resource">,
  workspaceId: Id<"workspace">
) {
  const resource = await ctx.db.get(resourceId);
  if (!resource || resource.workspaceId !== workspaceId) {
    return;
  }
  if (!resource.deletedAt) {
    return;
  }

  const tagJunctions = await ctx.db
    .query("resourceTag")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();
  for (const junction of tagJunctions) {
    await ctx.db.delete(junction._id);
  }

  const pins = await ctx.db
    .query("userResourcePin")
    .filter((q) => q.eq(q.field("resourceId"), resourceId))
    .collect();
  for (const pin of pins) {
    await ctx.db.delete(pin._id);
  }

  await deleteDerivedArtifacts(ctx, resourceId, resource.createdBy);

  await ctx.db.delete(resourceId);
}

export const purgeMany = workspaceMutation({
  args: {
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    for (const resourceId of args.resourceIds) {
      await purgeResource(ctx, resourceId, ctx.workspace._id);
    }
  },
});

export const purgeAllTrashed = workspaceMutation({
  args: {},
  handler: async (ctx) => {
    const trashed = await ctx.db
      .query("resource")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();
    for (const resource of trashed) {
      await purgeResource(ctx, resource._id, ctx.workspace._id);
    }
  },
});

export const moveManyToCollection = workspaceMutation({
  args: {
    resourceIds: v.array(v.id("resource")),
    collectionId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    if (args.collectionId) {
      const collection = await ctx.db.get(args.collectionId);
      if (
        !collection ||
        collection.workspaceId !== ctx.workspace._id ||
        collection.deletedAt
      ) {
        throw new ConvexError("Collection not found");
      }
    }

    const now = Date.now();
    for (const resourceId of args.resourceIds) {
      const resource = await ctx.db.get(resourceId);
      if (!resource || resource.workspaceId !== ctx.workspace._id) {
        continue;
      }
      await ctx.db.patch(resourceId, {
        collectionId: args.collectionId,
        updatedAt: now,
      });
    }
  },
});

export const togglePinMany = workspaceMutation({
  args: {
    resourceIds: v.array(v.id("resource")),
    pinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const resourceId of args.resourceIds) {
      const resource = await ctx.db.get(resourceId);
      if (!resource || resource.workspaceId !== ctx.workspace._id) {
        continue;
      }

      const existing = await ctx.db
        .query("userResourcePin")
        .withIndex("by_user_resource", (q) =>
          q.eq("userId", ctx.user._id).eq("resourceId", resourceId)
        )
        .unique();

      if (args.pinned) {
        if (!existing) {
          await ctx.db.insert("userResourcePin", {
            userId: ctx.user._id,
            resourceId,
            workspaceId: ctx.workspace._id,
            pinnedAt: Date.now(),
          });
        }
      } else if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
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

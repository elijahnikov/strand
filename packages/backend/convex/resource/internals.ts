import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../_generated/server";
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

const PLAIN_TEXT_SNIPPET_LEN = 160;

async function buildExtPreview(ctx: QueryCtx, resource: Doc<"resource">) {
  const base = {
    _id: resource._id,
    type: resource.type,
    title: resource.title,
    description: resource.description ?? null,
    updatedAt: resource.updatedAt ?? resource._creationTime,
  };

  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      return {
        ...base,
        url: website?.url ?? null,
        domain: website?.domain ?? null,
        previewUrl: website?.ogImage ?? null,
        faviconUrl: website?.favicon ?? null,
      };
    }
    case "file": {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      let previewUrl: string | null = null;
      if (file?.thumbnailStorageId) {
        previewUrl = await ctx.storage.getUrl(file.thumbnailStorageId);
      } else if (file?.mimeType?.startsWith("image/") && file.storageId) {
        previewUrl = await ctx.storage.getUrl(file.storageId);
      }
      return {
        ...base,
        mimeType: file?.mimeType ?? null,
        fileName: file?.fileName ?? null,
        previewUrl,
      };
    }
    case "note": {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      const snippet = note?.plainTextContent
        ? note.plainTextContent.slice(0, PLAIN_TEXT_SNIPPET_LEN)
        : null;
      return {
        ...base,
        snippet,
      };
    }
    default:
      return base;
  }
}

export const listForUser = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    type: v.optional(
      v.union(v.literal("website"), v.literal("note"), v.literal("file"))
    ),
  },
  handler: async (ctx, args) => {
    const search = args.search?.trim();
    const workspaceId: Id<"workspace"> = args.workspaceId;

    let results: {
      page: Doc<"resource">[];
      isDone: boolean;
      continueCursor: string;
    };

    if (search) {
      results = await ctx.db
        .query("resource")
        .withSearchIndex("search_title", (q) => {
          let sq = q
            .search("title", search)
            .eq("workspaceId", workspaceId)
            .eq("deletedAt", undefined);
          if (args.type) {
            sq = sq.eq("type", args.type);
          }
          return sq;
        })
        .paginate(args.paginationOpts);
    } else if (args.type) {
      results = await ctx.db
        .query("resource")
        .withIndex("by_workspace_type", (q) =>
          q
            .eq("workspaceId", workspaceId)
            // biome-ignore lint/style/noNonNullAssertion: type checked above
            .eq("type", args.type!)
            .eq("deletedAt", undefined)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      results = await ctx.db
        .query("resource")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspaceId).eq("deletedAt", undefined)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    const items = await Promise.all(
      results.page.map((resource) => buildExtPreview(ctx, resource))
    );

    return {
      items,
      cursor: results.continueCursor,
      isDone: results.isDone,
    };
  },
});

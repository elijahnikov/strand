import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { workspaceQuery } from "../utils";

async function getTagsForResource(ctx: QueryCtx, resourceId: Id<"resource">) {
  const resourceTags = await ctx.db
    .query("resourceTag")
    .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
    .collect();

  const results: Array<{ _id: Id<"tag">; name: string; color?: string }> = [];
  for (const rt of resourceTags) {
    const tag = await ctx.db.get(rt.tagId);
    if (tag) {
      results.push({ _id: tag._id, name: tag.name, color: tag.color });
    }
  }
  return results;
}

async function getResourcePreview(ctx: QueryCtx, resource: Doc<"resource">) {
  const preview: {
    ogImage?: string | null;
    favicon?: string | null;
    domain?: string | null;
    fileUrl?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    plainTextSnippet?: string | null;
  } = {};

  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (website) {
        preview.ogImage = website.ogImage;
        preview.favicon = website.favicon;
        preview.domain = website.domain;
      }
      break;
    }
    case "file": {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (file) {
        preview.mimeType = file.mimeType;
        preview.fileName = file.fileName;
        if (file.mimeType?.startsWith("image/") && file.storageId) {
          preview.fileUrl = await ctx.storage.getUrl(file.storageId);
        }
      }
      break;
    }
    case "note": {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (note?.plainTextContent) {
        preview.plainTextSnippet = note.plainTextContent.slice(0, 120);
      }
      break;
    }
    default:
      break;
  }

  return preview;
}

async function getLinksForResource(ctx: QueryCtx, resourceId: Id<"resource">) {
  const asSource = await ctx.db
    .query("resourceLink")
    .withIndex("by_source", (q) => q.eq("sourceResourceId", resourceId))
    .collect();

  const asTarget = await ctx.db
    .query("resourceLink")
    .withIndex("by_target", (q) => q.eq("targetResourceId", resourceId))
    .collect();

  const allLinks = [...asSource, ...asTarget];

  allLinks.sort((a, b) => b.score - a.score);

  const results: Array<{
    _id: Id<"resourceLink">;
    resource: {
      _id: Id<"resource">;
      title: string;
      type: string;
      preview: {
        ogImage?: string | null;
        favicon?: string | null;
        domain?: string | null;
        fileUrl?: string | null;
        mimeType?: string | null;
        fileName?: string | null;
        plainTextSnippet?: string | null;
      };
    };
    score: number;
    sharedConcepts: string[];
    status: string;
  }> = [];
  for (const link of allLinks.slice(0, 10)) {
    const linkedResourceId =
      link.sourceResourceId === resourceId
        ? link.targetResourceId
        : link.sourceResourceId;

    const linkedResource = await ctx.db.get(linkedResourceId);
    if (!linkedResource || linkedResource.deletedAt) {
      continue;
    }

    const preview = await getResourcePreview(ctx, linkedResource);

    results.push({
      _id: link._id,
      resource: {
        _id: linkedResource._id,
        title: linkedResource.title,
        type: linkedResource.type,
        preview,
      },
      score: link.score,
      sharedConcepts: link.sharedConcepts,
      status: link.status,
    });
  }

  return results;
}

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

    const createdBy = await ctx.db
      .query("user")
      .withIndex("by_id", (q) => q.eq("_id", resource.createdBy))
      .unique();

    const links = await getLinksForResource(ctx, resource._id);
    const tags = await getTagsForResource(ctx, resource._id);
    const content = await ctx.db
      .query("resourceContent")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .unique();

    switch (resource.type) {
      case "website": {
        const website = await ctx.db
          .query("websiteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        return {
          ...resource,
          website,
          content,
          type: resource.type,
          resourceAI,
          createdBy,

          links,
          tags,
        };
      }
      case "note": {
        const note = await ctx.db
          .query("noteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        return {
          ...resource,
          note,
          content,
          type: resource.type,
          resourceAI,
          createdBy,

          links,
          tags,
        };
      }
      case "file": {
        const file = await ctx.db
          .query("fileResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        const fileUrl = file?.storageId
          ? await ctx.storage.getUrl(file.storageId)
          : null;
        return {
          ...resource,
          file,
          fileUrl,
          content,
          type: resource.type,
          resourceAI,
          createdBy,

          links,
          tags,
        };
      }
      default:
        return {
          ...resource,
          content,
          type: resource.type,
          aiStatus: resourceAI?.status,
          resourceAI,
          createdBy,

          links,
          tags,
        };
    }
  },
});

export const getResourceLinks = workspaceQuery({
  args: { resourceId: v.id("resource") },
  handler: (ctx, args) => {
    return getLinksForResource(ctx, args.resourceId);
  },
});

export const getTag = workspaceQuery({
  args: { tagName: v.string() },
  handler: async (ctx, args) => {
    const tag = await ctx.db
      .query("tag")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("name", args.tagName)
      )
      .unique();
    if (!tag) {
      return null;
    }
    return { _id: tag._id, name: tag.name, color: tag.color };
  },
});

export const listByTag = workspaceQuery({
  args: { tagName: v.string() },
  handler: async (ctx, args) => {
    const tag = await ctx.db
      .query("tag")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("name", args.tagName)
      )
      .unique();

    if (!tag) {
      return [];
    }

    const resourceTags = await ctx.db
      .query("resourceTag")
      .withIndex("by_workspace_tag", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("tagId", tag._id)
      )
      .collect();

    const resources = await Promise.all(
      resourceTags.map(async (rt) => {
        const resource = await ctx.db.get(rt.resourceId);
        if (!resource || resource.deletedAt) {
          return null;
        }
        return enrichResource(ctx, resource);
      })
    );

    return resources.filter((r) => r !== null);
  },
});

export const listWorkspaceTags = workspaceQuery({
  args: {},
  handler: (ctx) => {
    return ctx.db
      .query("tag")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();
  },
});

const orderValidator = v.optional(
  v.union(v.literal("newest"), v.literal("oldest"), v.literal("alphabetical"))
);

const typeValidator = v.optional(
  v.union(v.literal("website"), v.literal("note"), v.literal("file"))
);

export const list = workspaceQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    type: typeValidator,
    order: orderValidator,
    collectionId: v.optional(v.id("collection")),
    allResources: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workspaceId = ctx.workspace._id;
    const search = args.search?.trim();
    const scopeToCollection = !args.allResources;

    // biome-ignore lint/suspicious/noEvolvingTypes: <>
    // biome-ignore lint/suspicious/noImplicitAnyLet: <>
    let results;

    if (search) {
      const query = ctx.db
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
        });
      results = await query.paginate(args.paginationOpts);
    } else if (scopeToCollection) {
      // Collection-scoped queries (root when collectionId is undefined)
      const collectionId = args.collectionId;
      if (args.type) {
        const isAlpha = args.order === "alphabetical";
        const indexName = isAlpha
          ? "by_workspace_collection_type_title"
          : "by_workspace_collection_type";

        const query = ctx.db
          .query("resource")
          .withIndex(indexName, (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("collectionId", collectionId)
              // biome-ignore lint/style/noNonNullAssertion: <>
              .eq("type", args.type!)
              .eq("deletedAt", undefined)
          )
          .order(isAlpha || args.order === "oldest" ? "asc" : "desc");

        results = await query.paginate(args.paginationOpts);
      } else {
        const isAlpha = args.order === "alphabetical";
        const indexName = isAlpha
          ? "by_workspace_collection_title"
          : "by_workspace_collection";

        const query = ctx.db
          .query("resource")
          .withIndex(indexName, (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("collectionId", collectionId)
              .eq("deletedAt", undefined)
          )
          .order(isAlpha || args.order === "oldest" ? "asc" : "desc");

        results = await query.paginate(args.paginationOpts);
      }
    } else if (args.type) {
      const isAlpha = args.order === "alphabetical";
      const indexName = isAlpha
        ? "by_workspace_type_title"
        : "by_workspace_type";

      const query = ctx.db
        .query("resource")
        .withIndex(indexName, (q) =>
          q
            .eq("workspaceId", workspaceId)
            // biome-ignore lint/style/noNonNullAssertion: <>
            .eq("type", args.type!)
            .eq("deletedAt", undefined)
        )
        .order(isAlpha || args.order === "oldest" ? "asc" : "desc");

      results = await query.paginate(args.paginationOpts);
    } else {
      const isAlpha = args.order === "alphabetical";
      const indexName = isAlpha ? "by_workspace_title" : "by_workspace";

      const query = ctx.db
        .query("resource")
        .withIndex(indexName, (q) =>
          q.eq("workspaceId", workspaceId).eq("deletedAt", undefined)
        )
        .order(isAlpha || args.order === "oldest" ? "asc" : "desc");

      results = await query.paginate(args.paginationOpts);
    }

    const enrichedPage = await Promise.all(
      results.page.map((resource) => enrichResource(ctx, resource))
    );

    return { ...results, page: enrichedPage };
  },
});

export const listPinned = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const pins = await ctx.db
      .query("userResourcePin")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id)
      )
      .collect();

    const resources = await Promise.all(
      pins.map(async (pin) => {
        const resource = await ctx.db.get(pin.resourceId);
        if (!resource || resource.deletedAt) {
          return null;
        }
        return enrichResource(ctx, resource);
      })
    );

    return resources.filter((r) => r !== null);
  },
});

const enrichResource = async (ctx: QueryCtx, resource: Doc<"resource">) => {
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
};

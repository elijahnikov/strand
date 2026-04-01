import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
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
  },
  handler: async (ctx, args) => {
    const workspaceId = ctx.workspace._id;

    const search = args.search?.trim();

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

async function enrichResource(ctx: QueryCtx, resource: Doc<"resource">) {
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
}

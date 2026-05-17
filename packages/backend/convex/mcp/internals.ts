import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";

async function getResourcePreview(ctx: QueryCtx, resource: Doc<"resource">) {
  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      return {
        url: website?.url ?? null,
        domain: website?.domain ?? null,
      };
    }
    case "note": {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      return {
        snippet: note?.plainTextContent
          ? note.plainTextContent.slice(0, 240)
          : null,
      };
    }
    case "file": {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      return {
        fileName: file?.fileName ?? null,
        mimeType: file?.mimeType ?? null,
      };
    }
    default:
      return {};
  }
}

export const listCollections = internalQuery({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("collection")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deletedAt", undefined)
      )
      .collect();

    return rows.map((c) => ({
      _id: c._id,
      name: c.name,
      parentId: c.parentId ?? null,
    }));
  },
});

export const getResource = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (
      !resource ||
      resource.workspaceId !== args.workspaceId ||
      resource.deletedAt
    ) {
      return null;
    }

    const resourceAI = await ctx.db
      .query("resourceAI")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .unique();

    let content: string | undefined;
    let url: string | undefined;
    if (resource.type === "note") {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      content = note?.plainTextContent;
    } else if (resource.type === "website") {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      content = website?.articleContent;
      url = website?.url;
    } else if (resource.type === "file") {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      content = file?.extractedText;
    }

    return {
      _id: resource._id,
      title: resource.title,
      type: resource.type,
      description: resource.description ?? null,
      url: url ?? null,
      summary: resourceAI?.summary ?? null,
      tags: resourceAI?.tags ?? null,
      content: content ? content.slice(0, 8000) : null,
      createdAt: resource._creationTime,
      updatedAt: resource.updatedAt,
    };
  },
});

export const validateMembership = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.deletedAt) {
      return false;
    }
    if (workspace.ownerId === args.userId) {
      return true;
    }
    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();
    return Boolean(member);
  },
});

export const searchTitleHits = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const normalized = args.query.toLowerCase().trim();
    if (!normalized) {
      return [] as Array<{
        _id: Id<"resource">;
        title: string;
        type: string;
        preview: Awaited<ReturnType<typeof getResourcePreview>>;
      }>;
    }

    const hits = await ctx.db
      .query("resource")
      .withSearchIndex("search_title", (q) =>
        q
          .search("title", normalized)
          .eq("workspaceId", args.workspaceId)
          .eq("deletedAt", undefined)
      )
      .take(args.limit);

    return await Promise.all(
      hits.map(async (r) => ({
        _id: r._id,
        title: r.title,
        type: r.type,
        preview: await getResourcePreview(ctx, r),
      }))
    );
  },
});

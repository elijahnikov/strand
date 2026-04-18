import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";

export const validateMembership = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    if (workspace.ownerId === user._id) {
      return { user, workspace };
    }
    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();
    if (!member) {
      return null;
    }
    return { user, workspace };
  },
});

export const hasEmbeddings = internalQuery({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args) => {
    const sample = await ctx.db
      .query("resourceEmbedding")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1);
    return sample.length > 0;
  },
});

export const titleSearch = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const normalized = args.query.toLowerCase().trim();
    if (!normalized) {
      return [] as Array<{ resourceId: Id<"resource">; rank: number }>;
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

    const filtered = hits.filter((r) =>
      r.title.toLowerCase().includes(normalized)
    );
    const source = filtered.length > 0 ? filtered : hits;

    return source.slice(0, args.limit).map((r, rank) => ({
      resourceId: r._id,
      rank,
    }));
  },
});

export const tagSearch = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const normalized = args.query.trim();
    if (!normalized) {
      return [] as Array<{
        resourceId: Id<"resource">;
        tagId: Id<"tag">;
        tagName: string;
        rank: number;
      }>;
    }

    const tags = await ctx.db
      .query("tag")
      .withSearchIndex("search_name", (q) =>
        q.search("name", normalized).eq("workspaceId", args.workspaceId)
      )
      .take(5);

    const out: Array<{
      resourceId: Id<"resource">;
      tagId: Id<"tag">;
      tagName: string;
      rank: number;
    }> = [];

    let rank = 0;
    for (const tag of tags) {
      const links = await ctx.db
        .query("resourceTag")
        .withIndex("by_workspace_tag", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("tagId", tag._id)
        )
        .collect();
      for (const link of links) {
        out.push({
          resourceId: link.resourceId,
          tagId: tag._id,
          tagName: tag.name,
          rank,
        });
        rank += 1;
        if (out.length >= args.limit) {
          return out;
        }
      }
    }

    return out;
  },
});

export const listResourcesForConcepts = internalQuery({
  args: {
    conceptIds: v.array(v.id("concept")),
  },
  handler: async (ctx, args) => {
    const out: Array<{
      resourceId: Id<"resource">;
      conceptId: Id<"concept">;
      conceptName: string;
      importance: number;
    }> = [];

    const seen = new Set<string>();
    for (const conceptId of args.conceptIds) {
      const concept = await ctx.db.get(conceptId);
      if (!concept) {
        continue;
      }
      const links = await ctx.db
        .query("resourceConcept")
        .withIndex("by_concept", (q) => q.eq("conceptId", conceptId))
        .collect();

      for (const link of links) {
        const key = `${link.resourceId}:${conceptId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        out.push({
          resourceId: link.resourceId,
          conceptId,
          conceptName: concept.name,
          importance: link.importance,
        });
      }
    }
    return out;
  },
});

export const listResourcesForTags = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    tagIds: v.array(v.id("tag")),
  },
  handler: async (ctx, args) => {
    const sets = await Promise.all(
      args.tagIds.map(async (tagId) => {
        const links = await ctx.db
          .query("resourceTag")
          .withIndex("by_workspace_tag", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("tagId", tagId)
          )
          .collect();
        return new Set(links.map((l) => l.resourceId));
      })
    );
    return sets;
  },
});

async function enrichOne(ctx: QueryCtx, resource: Doc<"resource">) {
  const resourceAI = await ctx.db
    .query("resourceAI")
    .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
    .unique();

  const resourceTags = await ctx.db
    .query("resourceTag")
    .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
    .collect();
  const tags: Array<{ _id: Id<"tag">; name: string; color?: string }> = [];
  for (const rt of resourceTags) {
    const tag = await ctx.db.get(rt.tagId);
    if (tag) {
      tags.push({ _id: tag._id, name: tag.name, color: tag.color });
    }
  }

  const resourceConcepts = await ctx.db
    .query("resourceConcept")
    .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
    .collect();
  const concepts: Array<{
    _id: Id<"concept">;
    name: string;
    importance: number;
  }> = [];
  for (const rc of resourceConcepts) {
    const concept = await ctx.db.get(rc.conceptId);
    if (concept) {
      concepts.push({
        _id: concept._id,
        name: concept.name,
        importance: rc.importance,
      });
    }
  }

  const aiStatus = resourceAI?.status;
  const summary = resourceAI?.summary;
  const sentiment = resourceAI?.sentiment;
  const language = resourceAI?.language;
  const category = resourceAI?.category;

  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      return {
        ...resource,
        website,
        aiStatus,
        summary,
        sentiment,
        language,
        category,
        tags,
        concepts,
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
        aiStatus,
        summary,
        sentiment,
        language,
        category,
        tags,
        concepts,
      };
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
      return {
        ...resource,
        file,
        fileUrl,
        aiStatus,
        summary,
        sentiment,
        language,
        category,
        tags,
        concepts,
      };
    }
    default:
      return {
        ...resource,
        aiStatus,
        summary,
        sentiment,
        language,
        category,
        tags,
        concepts,
      };
  }
}

export const enrichResources = internalQuery({
  args: {
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    const out = await Promise.all(
      args.resourceIds.map(async (id) => {
        const resource = await ctx.db.get(id);
        if (!resource || resource.deletedAt) {
          return null;
        }
        return await enrichOne(ctx, resource);
      })
    );
    return out.filter((r) => r !== null);
  },
});

export const getUserMemoryContent = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userMemory")
      .withIndex("by_user_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();
    return row?.content ?? null;
  },
});

export const getChunksByIds = internalQuery({
  args: { chunkIds: v.array(v.id("resourceChunk")) },
  handler: async (ctx, args) => {
    return await Promise.all(args.chunkIds.map((id) => ctx.db.get(id)));
  },
});

export const getResourceIdsForEmbeddings = internalQuery({
  args: { embeddingIds: v.array(v.id("resourceEmbedding")) },
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.embeddingIds.map((id) => ctx.db.get(id))
    );
    return docs.map((doc) => doc?.resourceId ?? null);
  },
});

const listOpValidator = v.union(v.literal("is"), v.literal("isNot"));
const dateOpValidator = v.union(
  v.literal("before"),
  v.literal("after"),
  v.literal("between")
);

export const listFilteredResourceIds = internalQuery({
  args: {
    workspaceId: v.id("workspace"),
    types: v.optional(
      v.array(
        v.union(v.literal("website"), v.literal("note"), v.literal("file"))
      )
    ),
    typesOp: v.optional(listOpValidator),
    createdBy: v.optional(v.array(v.id("user"))),
    createdByOp: v.optional(listOpValidator),
    collectionId: v.optional(v.union(v.id("collection"), v.null())),
    collectionIdOp: v.optional(listOpValidator),
    isPinned: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    dateOp: v.optional(dateOpValidator),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("resource")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deletedAt", undefined)
      )
      .collect();

    const typesOp = args.typesOp ?? "is";
    const createdByOp = args.createdByOp ?? "is";
    const collectionOp = args.collectionIdOp ?? "is";
    const dateOp = args.dateOp ?? "between";

    const filtered = all.filter((r) => {
      if (args.types && args.types.length > 0) {
        const matches = args.types.includes(r.type);
        if (typesOp === "is" && !matches) {
          return false;
        }
        if (typesOp === "isNot" && matches) {
          return false;
        }
      }
      if (args.createdBy && args.createdBy.length > 0) {
        const matches = args.createdBy.includes(r.createdBy);
        if (createdByOp === "is" && !matches) {
          return false;
        }
        if (createdByOp === "isNot" && matches) {
          return false;
        }
      }
      if (args.isPinned !== undefined && r.isPinned !== args.isPinned) {
        return false;
      }
      if (args.isFavorite !== undefined && r.isFavorite !== args.isFavorite) {
        return false;
      }
      if (args.isArchived !== undefined) {
        if (r.isArchived !== args.isArchived) {
          return false;
        }
      } else if (r.isArchived) {
        return false;
      }
      if (args.collectionId !== undefined) {
        const matches =
          args.collectionId === null
            ? !r.collectionId
            : r.collectionId === args.collectionId;
        if (collectionOp === "is" && !matches) {
          return false;
        }
        if (collectionOp === "isNot" && matches) {
          return false;
        }
      }
      if (
        (dateOp === "after" || dateOp === "between") &&
        args.dateFrom !== undefined &&
        r._creationTime < args.dateFrom
      ) {
        return false;
      }
      if (
        (dateOp === "before" || dateOp === "between") &&
        args.dateTo !== undefined &&
        r._creationTime > args.dateTo
      ) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => b._creationTime - a._creationTime);
    return filtered.slice(0, args.limit).map((r) => r._id);
  },
});

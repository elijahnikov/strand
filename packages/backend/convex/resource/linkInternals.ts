import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const insertConcept = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    name: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("concept", {
      workspaceId: args.workspaceId,
      name: args.name,
      embedding: args.embedding,
    });
  },
});

export const insertResourceConcept = internalMutation({
  args: {
    resourceId: v.id("resource"),
    conceptId: v.id("concept"),
    workspaceId: v.id("workspace"),
    importance: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("resourceConcept", {
      resourceId: args.resourceId,
      conceptId: args.conceptId,
      workspaceId: args.workspaceId,
      importance: args.importance,
    });
  },
});

export const deleteResourceConcepts = internalMutation({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const concepts = await ctx.db
      .query("resourceConcept")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    for (const concept of concepts) {
      await ctx.db.delete(concept._id);
    }
  },
});

export const getResourceConcepts = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resourceConcepts = await ctx.db
      .query("resourceConcept")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    const results: Array<{
      conceptId: string;
      name: string;
      importance: number;
    }> = [];
    for (const rc of resourceConcepts) {
      const concept = await ctx.db.get(rc.conceptId);
      if (concept) {
        results.push({
          conceptId: rc.conceptId,
          name: concept.name,
          importance: rc.importance,
        });
      }
    }
    return results;
  },
});

export const upsertResourceLink = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    sourceResourceId: v.id("resource"),
    targetResourceId: v.id("resource"),
    score: v.float64(),
    conceptOverlap: v.float64(),
    semanticSimilarity: v.float64(),
    sharedConcepts: v.array(v.string()),
    status: v.union(v.literal("auto"), v.literal("pinned")),
  },
  handler: async (ctx, args) => {
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
      if (existing.status === "pinned") {
        return existing._id;
      }
      await ctx.db.patch(existing._id, {
        score: args.score,
        conceptOverlap: args.conceptOverlap,
        semanticSimilarity: args.semanticSimilarity,
        sharedConcepts: args.sharedConcepts,
        status: args.status,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("resourceLink", {
      workspaceId: args.workspaceId,
      sourceResourceId: args.sourceResourceId,
      targetResourceId: args.targetResourceId,
      score: args.score,
      conceptOverlap: args.conceptOverlap,
      semanticSimilarity: args.semanticSimilarity,
      sharedConcepts: args.sharedConcepts,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getResourceLinks = internalQuery({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const asSource = await ctx.db
      .query("resourceLink")
      .withIndex("by_source", (q) => q.eq("sourceResourceId", args.resourceId))
      .collect();

    const asTarget = await ctx.db
      .query("resourceLink")
      .withIndex("by_target", (q) => q.eq("targetResourceId", args.resourceId))
      .collect();

    const allLinks = [...asSource, ...asTarget];

    allLinks.sort((a, b) => b.score - a.score);

    return allLinks;
  },
});

export const upsertTagsForResource = internalMutation({
  args: {
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const tagName of args.tags) {
      const normalized = tagName.trim().toLowerCase();
      if (normalized.length === 0) {
        continue;
      }

      let tag = await ctx.db
        .query("tag")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("name", normalized)
        )
        .unique();

      if (!tag) {
        const tagId = await ctx.db.insert("tag", {
          workspaceId: args.workspaceId,
          name: normalized,
        });
        tag = await ctx.db.get(tagId);
      }

      if (!tag) {
        continue;
      }

      const existing = await ctx.db
        .query("resourceTag")
        .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
        .filter((q) => q.eq(q.field("tagId"), tag._id))
        .unique();

      if (!existing) {
        await ctx.db.insert("resourceTag", {
          resourceId: args.resourceId,
          tagId: tag._id,
          workspaceId: args.workspaceId,
        });
      }
    }
  },
});

export const updateTagEmbedding = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    name: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db
      .query("tag")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.name)
      )
      .unique();
    if (tag && !tag.embedding) {
      await ctx.db.patch(tag._id, { embedding: args.embedding });
    }
  },
});

export const migrateResourceLinkStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("resourceLink").collect();
    let migrated = 0;
    let deleted = 0;

    for (const link of allLinks) {
      const status = link.status as string;
      if (status === "suggested" || status === "accepted") {
        await ctx.db.patch(link._id, { status: "auto" });
        migrated++;
      } else if (status === "rejected") {
        await ctx.db.delete(link._id);
        deleted++;
      }
    }

    return { migrated, deleted };
  },
});

export const getExistingLink = internalQuery({
  args: {
    sourceResourceId: v.id("resource"),
    targetResourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const forward = await ctx.db
      .query("resourceLink")
      .withIndex("by_source_target", (q) =>
        q
          .eq("sourceResourceId", args.sourceResourceId)
          .eq("targetResourceId", args.targetResourceId)
      )
      .unique();

    if (forward) {
      return forward;
    }

    return await ctx.db
      .query("resourceLink")
      .withIndex("by_source_target", (q) =>
        q
          .eq("sourceResourceId", args.targetResourceId)
          .eq("targetResourceId", args.sourceResourceId)
      )
      .unique();
  },
});

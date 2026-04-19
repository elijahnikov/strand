import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { workspaceQuery } from "../utils";
import { extractBoostTerms, matchesBoostTerms } from "./memoryBoost";

async function enrichForList(ctx: QueryCtx, resource: Doc<"resource">) {
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

const TOP_CONCEPTS_DEFAULT = 12;
const TOP_TAGS_DEFAULT = 8;

export const listTopConcepts = workspaceQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? TOP_CONCEPTS_DEFAULT;

    const links = await ctx.db
      .query("resourceConcept")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();

    const counts = new Map<Id<"concept">, { count: number; weight: number }>();
    for (const link of links) {
      const resource = await ctx.db.get(link.resourceId);
      if (!resource || resource.deletedAt) {
        continue;
      }
      const current = counts.get(link.conceptId) ?? { count: 0, weight: 0 };
      counts.set(link.conceptId, {
        count: current.count + 1,
        weight: current.weight + link.importance,
      });
    }

    const ranked = Array.from(counts.entries()).sort((a, b) => {
      const wa = a[1].weight;
      const wb = b[1].weight;
      if (wa !== wb) {
        return wb - wa;
      }
      return b[1].count - a[1].count;
    });

    const top = ranked.slice(0, limit);
    const out: Array<{
      _id: Id<"concept">;
      name: string;
      count: number;
      weight: number;
    }> = [];
    for (const [conceptId, stats] of top) {
      const concept = await ctx.db.get(conceptId);
      if (concept) {
        out.push({
          _id: concept._id,
          name: concept.name,
          count: stats.count,
          weight: stats.weight,
        });
      }
    }
    return out;
  },
});

export const listTopTags = workspaceQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? TOP_TAGS_DEFAULT;

    const tags = await ctx.db
      .query("tag")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();

    const out: Array<{
      _id: Id<"tag">;
      name: string;
      color?: string;
      count: number;
    }> = [];
    for (const tag of tags) {
      const links = await ctx.db
        .query("resourceTag")
        .withIndex("by_workspace_tag", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("tagId", tag._id)
        )
        .collect();
      let liveCount = 0;
      for (const link of links) {
        const resource = await ctx.db.get(link.resourceId);
        if (resource && !resource.deletedAt) {
          liveCount++;
        }
      }
      if (liveCount === 0) {
        continue;
      }
      out.push({
        _id: tag._id,
        name: tag.name,
        color: tag.color,
        count: liveCount,
      });
    }

    out.sort((a, b) => b.count - a.count);
    return out.slice(0, limit);
  },
});

export const workspaceStats = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const embeddingSample = await ctx.db
      .query("resourceEmbedding")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .take(1);
    const embeddingReady = embeddingSample.length > 0;

    const resourceSample = await ctx.db
      .query("resource")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("deletedAt", undefined)
      )
      .take(1);
    const hasResources = resourceSample.length > 0;

    return {
      embeddingReady,
      hasResources,
    };
  },
});

const SUGGESTED_LIMIT_DEFAULT = 6;

export const getSuggestedForYou = workspaceQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? SUGGESTED_LIMIT_DEFAULT;

    const memory = await ctx.db
      .query("userMemory")
      .withIndex("by_user_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id)
      )
      .first();

    const boostTerms = extractBoostTerms(memory?.content ?? null);
    if (boostTerms.length === 0) {
      return [];
    }

    const concepts = await ctx.db
      .query("concept")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();

    const matched = concepts.filter((c) =>
      matchesBoostTerms(c.name, boostTerms)
    );
    if (matched.length === 0) {
      return [];
    }

    const scoreByResource = new Map<
      Id<"resource">,
      { score: number; matchedConcept: string }
    >();

    for (const concept of matched) {
      const links = await ctx.db
        .query("resourceConcept")
        .withIndex("by_concept", (q) => q.eq("conceptId", concept._id))
        .collect();
      for (const link of links) {
        const current = scoreByResource.get(link.resourceId);
        if (!current || link.importance > current.score) {
          scoreByResource.set(link.resourceId, {
            score: link.importance,
            matchedConcept: concept.name,
          });
        }
      }
    }

    const ranked = Array.from(scoreByResource.entries()).sort(
      (a, b) => b[1].score - a[1].score
    );

    const picks: Array<{
      resource: Awaited<ReturnType<typeof enrichForList>>;
      matchedConcept: string;
    }> = [];

    for (const [resourceId, stats] of ranked) {
      if (picks.length >= limit) {
        break;
      }
      const resource = await ctx.db.get(resourceId);
      if (!resource || resource.deletedAt) {
        continue;
      }
      const enriched = await enrichForList(ctx, resource);
      picks.push({
        resource: enriched,
        matchedConcept: stats.matchedConcept,
      });
    }

    return picks;
  },
});

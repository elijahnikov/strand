"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";

export const semanticTagSearch = action({
  args: {
    workspaceId: v.id("workspace"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.runQuery(internal.resource.aiInternals.getTagByName, {
      workspaceId: args.workspaceId,
      tagName: args.tagName,
    });

    if (!tag?.embedding) {
      return [];
    }

    const results = await ctx.vectorSearch(
      "resourceEmbedding",
      "by_embedding",
      {
        vector: tag.embedding,
        limit: 20,
        filter: (q) => q.eq("workspaceId", args.workspaceId),
      }
    );

    const resources: Array<{
      resource: Record<string, unknown>;
      score: number;
    }> = [];

    for (const result of results) {
      const embeddingDoc = await ctx.runQuery(
        internal.resource.aiInternals.getEmbeddingById,
        { embeddingId: result._id }
      );
      if (!embeddingDoc) {
        continue;
      }

      const enriched = await ctx.runQuery(
        internal.resource.aiInternals.enrichResourceById,
        { resourceId: embeddingDoc.resourceId as Id<"resource"> }
      );
      if (!enriched) {
        continue;
      }

      resources.push({
        resource: enriched as Record<string, unknown>,
        score: result._score,
      });
    }

    return resources;
  },
});

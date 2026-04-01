"use node";

import { generateEmbedding } from "@strand/ai/embeddings";
import { createOpenAIProvider } from "@strand/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

interface SearchResult {
  resourceId: string;
  score: number;
  title: string;
  type: string;
}

export const semanticSearch = internalAction({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const provider = createOpenAIProvider(apiKey);
    const searchLimit = args.limit ?? 10;

    const { embedding } = await generateEmbedding(provider, args.query);

    const results = await ctx.vectorSearch(
      "resourceEmbedding",
      "by_embedding",
      {
        vector: embedding,
        limit: searchLimit * 2,
        filter: (q) => q.eq("workspaceId", args.workspaceId),
      }
    );

    const resources: SearchResult[] = [];
    for (const result of results) {
      const embeddingDoc = await ctx.runQuery(
        internal.resource.aiInternals.getEmbeddingById,
        { embeddingId: result._id }
      );
      if (!embeddingDoc) {
        continue;
      }

      const resource = await ctx.runQuery(
        internal.resource.aiInternals.getResourceById,
        { resourceId: embeddingDoc.resourceId }
      );
      if (!resource) {
        continue;
      }

      resources.push({
        resourceId: embeddingDoc.resourceId,
        score: result._score,
        title: resource.title,
        type: resource.type,
      });

      if (resources.length >= searchLimit) {
        break;
      }
    }

    return resources;
  },
});

"use node";

import { generateEmbedding } from "@strand/ai/embeddings";
import { createOpenAIProvider } from "@strand/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { getAuthIdentity } from "../utils";

export const searchChunks = action({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.runQuery(
      internal.chat.internals.validateMembership,
      {
        workspaceId: args.workspaceId,
        userId: identity.userId as Id<"user">,
      }
    );

    if (!membership) {
      throw new Error("Not authorized");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [];
    }

    const provider = createOpenAIProvider(apiKey);
    const { embedding } = await generateEmbedding(provider, args.query);

    const results = await ctx.vectorSearch("resourceChunk", "by_embedding", {
      vector: embedding,
      limit: (args.limit ?? 10) * 4,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const seen = new Set<string>();
    const chunks: Array<{
      chunkId: string;
      resourceId: string;
      content: string;
      score: number;
      chunkIndex: number;
      metadata?: { pageNumber?: number; sectionHeader?: string };
      resource: { _id: string; title: string; type: string };
    }> = [];

    const maxResults = args.limit ?? 10;

    for (const result of results) {
      if (chunks.length >= maxResults) {
        break;
      }

      const chunk = await ctx.runQuery(
        internal.resource.aiInternals.getChunkById,
        { chunkId: result._id }
      );
      if (!chunk) {
        continue;
      }

      if (seen.has(chunk.resourceId)) {
        continue;
      }
      seen.add(chunk.resourceId);

      const resource = await ctx.runQuery(
        internal.resource.aiInternals.getResourceById,
        { resourceId: chunk.resourceId }
      );
      if (!resource) {
        continue;
      }

      chunks.push({
        chunkId: chunk._id,
        resourceId: chunk.resourceId,
        content: chunk.content,
        score: result._score,
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata,
        resource: {
          _id: resource._id,
          title: resource.title,
          type: resource.type,
        },
      });
    }

    return chunks;
  },
});

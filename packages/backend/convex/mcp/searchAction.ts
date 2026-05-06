"use node";

import { generateEmbedding } from "@omi/ai/embeddings";
import { createOpenAIProvider } from "@omi/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { tokensToCredits } from "../billing/credits";
import { rateLimiter } from "../rateLimiter";

export const searchLibraryForUser = internalAction({
  args: {
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "chatSearch", {
      key: args.userId,
      throws: true,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [];
    }

    const billingAccount = await ctx.runQuery(
      internal.billing.credits.preflight,
      {
        userId: args.userId,
        workspaceId: args.workspaceId,
        estimate: 1,
      }
    );

    const provider = createOpenAIProvider(apiKey);
    const { embedding, model, tokens } = await generateEmbedding(
      provider,
      args.query
    );
    await ctx.runMutation(internal.billing.credits.debit, {
      billingAccountId: billingAccount.billingAccountId,
      workspaceId: args.workspaceId,
      actingUserId: args.userId,
      reason: "chat",
      amount: tokensToCredits(tokens, model),
    });

    const maxResults = args.limit ?? 10;
    const results = await ctx.vectorSearch("resourceChunk", "by_embedding", {
      vector: embedding,
      limit: maxResults * 4,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const seen = new Set<string>();
    const passages: Array<{
      resourceId: Id<"resource">;
      resourceTitle: string;
      resourceType: string;
      content: string;
      score: number;
    }> = [];

    for (const result of results) {
      if (passages.length >= maxResults) {
        break;
      }
      const chunk = await ctx.runQuery(
        internal.resource.aiInternals.getChunkById,
        { chunkId: result._id }
      );
      if (!chunk || seen.has(chunk.resourceId)) {
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
      passages.push({
        resourceId: chunk.resourceId,
        resourceTitle: resource.title,
        resourceType: resource.type,
        content: chunk.content.slice(0, 800),
        score: result._score,
      });
    }

    return passages;
  },
});

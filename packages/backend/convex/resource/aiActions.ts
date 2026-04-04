"use node";

import { createHash } from "node:crypto";
import { normalizeConceptName } from "@strand/ai/concepts";
import { generateEmbedding, generateEmbeddings } from "@strand/ai/embeddings";
import { createEnricher, type EnricherInput } from "@strand/ai/enrichment";
import { createOpenAIProvider } from "@strand/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

const RETRY_BACKOFFS = [5000, 30_000, 120_000];
const MIN_CONTENT_LENGTH = 50;

function computeHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const processResourceAI = internalAction({
  args: {
    resourceId: v.id("resource"),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.resource.aiInternals.setResourceAIStatus, {
        resourceId: args.resourceId,
        status: "failed",
        error: "OPENAI_API_KEY not configured",
      });
      return;
    }

    await ctx.runMutation(internal.resource.aiInternals.setResourceAIStatus, {
      resourceId: args.resourceId,
      status: "processing",
    });

    try {
      const content = await ctx.runQuery(
        internal.resource.aiInternals.getResourceContent,
        { resourceId: args.resourceId }
      );

      const provider = createOpenAIProvider(apiKey);

      let enricherInput: EnricherInput | undefined;
      let embeddingText = content.title;

      switch (content.type) {
        case "website": {
          enricherInput = {
            type: "website",
            data: {
              title: content.title,
              url: content.url ?? "",
              articleContent: content.articleContent,
              ogDescription: content.ogDescription,
            },
          };
          embeddingText =
            content.articleContent ?? content.ogDescription ?? content.title;
          break;
        }
        case "note": {
          enricherInput = {
            type: "note",
            data: {
              title: content.title,
              plainTextContent: content.plainTextContent,
            },
          };
          embeddingText = content.plainTextContent ?? content.title;
          break;
        }
        case "file": {
          if (!(content.fileUrl && content.mimeType && content.fileName)) {
            await ctx.runMutation(
              internal.resource.aiInternals.setResourceAIStatus,
              {
                resourceId: args.resourceId,
                status: "failed",
                error: "File metadata incomplete",
              }
            );
            return;
          }
          enricherInput = {
            type: "file",
            data: {
              title: content.title,
              fileUrl: content.fileUrl,
              mimeType: content.mimeType,
              fileName: content.fileName,
            },
          };
          embeddingText = content.title;
          break;
        }
        default:
          break;
      }

      const isTextBased = content.type === "website" || content.type === "note";
      if (isTextBased && embeddingText.length < MIN_CONTENT_LENGTH) {
        await ctx.runMutation(
          internal.resource.aiInternals.setResourceAIStatus,
          {
            resourceId: args.resourceId,
            status: "completed",
          }
        );
        return;
      }

      if (!enricherInput) {
        return;
      }

      const enricher = createEnricher(provider, enricherInput);
      const result = await enricher.enrich();

      await ctx.runMutation(internal.resource.aiInternals.updateResourceAI, {
        resourceId: args.resourceId,
        summary: result.summary,
        tags: result.tags,
        extractedEntities: result.extractedEntities,
        sentiment: result.sentiment,
        language: result.language,
        category: result.category,
        keyQuotes: result.keyQuotes,
      });

      if (result.tags.length > 0) {
        await ctx.runMutation(
          internal.resource.linkInternals.upsertTagsForResource,
          {
            resourceId: args.resourceId,
            workspaceId: content.workspaceId,
            tags: result.tags,
          }
        );

        const normalizedTags = result.tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0);

        if (normalizedTags.length > 0) {
          const { embeddings: tagEmbeddings } = await generateEmbeddings(
            provider,
            normalizedTags
          );

          for (let i = 0; i < normalizedTags.length; i++) {
            const tagName = normalizedTags[i];
            const tagEmbedding = tagEmbeddings[i];
            if (tagName && tagEmbedding) {
              await ctx.runMutation(
                internal.resource.linkInternals.updateTagEmbedding,
                {
                  workspaceId: content.workspaceId,
                  name: tagName,
                  embedding: tagEmbedding,
                }
              );
            }
          }
        }
      }

      if (result.concepts && result.concepts.length > 0) {
        await ctx.runMutation(
          internal.resource.linkInternals.deleteResourceConcepts,
          { resourceId: args.resourceId }
        );

        const normalizedConcepts = result.concepts.map((c) => ({
          name: normalizeConceptName(c.name),
          displayName: c.name,
          importance: c.importance,
        }));

        const conceptNames = normalizedConcepts.map((c) => c.name);
        const { embeddings: conceptEmbeddings } = await generateEmbeddings(
          provider,
          conceptNames
        );

        for (let i = 0; i < normalizedConcepts.length; i++) {
          const concept = normalizedConcepts[i];
          const conceptEmbedding = conceptEmbeddings[i];

          if (!(concept && conceptEmbedding)) {
            continue;
          }

          const similar = await ctx.vectorSearch("concept", "by_embedding", {
            vector: conceptEmbedding,
            limit: 1,
            filter: (q) => q.eq("workspaceId", content.workspaceId),
          });

          const DEDUP_THRESHOLD = 0.92;
          const topMatch = similar[0];
          let conceptId: string | undefined;

          if (topMatch && topMatch._score >= DEDUP_THRESHOLD) {
            conceptId = topMatch._id;
          } else {
            conceptId = await ctx.runMutation(
              internal.resource.linkInternals.insertConcept,
              {
                workspaceId: content.workspaceId,
                name: concept.displayName,
                embedding: conceptEmbedding,
              }
            );
          }

          await ctx.runMutation(
            internal.resource.linkInternals.insertResourceConcept,
            {
              resourceId: args.resourceId,
              conceptId: conceptId as Id<"concept">,
              workspaceId: content.workspaceId,
              importance: concept.importance,
            }
          );
        }
      }

      if (content.type === "file") {
        embeddingText = `${result.summary} ${result.tags.join(" ")}`;
      }

      const inputHash = computeHash(embeddingText);
      const { embedding, model } = await generateEmbedding(
        provider,
        embeddingText
      );

      await ctx.runMutation(
        internal.resource.aiInternals.upsertResourceEmbedding,
        {
          resourceId: args.resourceId,
          workspaceId: content.workspaceId,
          embedding,
          model,
          inputHash,
        }
      );

      await ctx.scheduler.runAfter(
        0,
        internal.resource.aiActions.generateResourceLinks,
        {
          resourceId: args.resourceId,
          workspaceId: content.workspaceId,
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (attempt < RETRY_BACKOFFS.length) {
        const delay = RETRY_BACKOFFS[attempt] as number;
        await ctx.scheduler.runAfter(
          delay,
          internal.resource.aiActions.processResourceAI,
          {
            resourceId: args.resourceId,
            attempt: attempt + 1,
          }
        );
      } else {
        await ctx.runMutation(
          internal.resource.aiInternals.setResourceAIStatus,
          {
            resourceId: args.resourceId,
            status: "failed",
            error: errorMessage,
          }
        );
      }
    }
  },
});

function computeWeightedJaccard(
  conceptsA: Array<{ name: string; importance: number }>,
  conceptsB: Array<{ name: string; importance: number }>
): { overlap: number; sharedNames: string[] } {
  const mapA = new Map(
    conceptsA.map((c) => [c.name.toLowerCase(), c.importance])
  );
  const mapB = new Map(
    conceptsB.map((c) => [c.name.toLowerCase(), c.importance])
  );

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  let intersectionSum = 0;
  let unionSum = 0;
  const sharedNames: string[] = [];

  for (const key of allKeys) {
    const a = mapA.get(key) ?? 0;
    const b = mapB.get(key) ?? 0;
    intersectionSum += Math.min(a, b);
    unionSum += Math.max(a, b);
    if (a > 0 && b > 0) {
      sharedNames.push(key);
    }
  }

  const overlap = unionSum > 0 ? intersectionSum / unionSum : 0;
  return { overlap, sharedNames };
}

export const generateResourceLinks = internalAction({
  args: {
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
  },
  handler: async (ctx, args) => {
    const sourceConcepts = await ctx.runQuery(
      internal.resource.linkInternals.getResourceConcepts,
      { resourceId: args.resourceId }
    );

    const sourceEmbedding = await ctx.runQuery(
      internal.resource.aiInternals.getResourceEmbedding,
      { resourceId: args.resourceId }
    );

    if (!sourceEmbedding) {
      return;
    }

    const similar = await ctx.vectorSearch(
      "resourceEmbedding",
      "by_embedding",
      {
        vector: sourceEmbedding.embedding,
        limit: 20,
        filter: (q) => q.eq("workspaceId", args.workspaceId),
      }
    );

    const HYBRID_THRESHOLD = 0.35;
    const SEMANTIC_ONLY_THRESHOLD = 0.4;
    const CONCEPT_WEIGHT = 0.7;
    const SEMANTIC_WEIGHT = 0.3;

    for (const candidate of similar) {
      const embeddingDoc = await ctx.runQuery(
        internal.resource.aiInternals.getEmbeddingById,
        { embeddingId: candidate._id }
      );
      if (!embeddingDoc) {
        continue;
      }

      if (embeddingDoc.resourceId === args.resourceId) {
        continue;
      }

      const candidateResource = await ctx.runQuery(
        internal.resource.aiInternals.getResourceById,
        { resourceId: embeddingDoc.resourceId }
      );
      if (!candidateResource) {
        continue;
      }

      const candidateConcepts = await ctx.runQuery(
        internal.resource.linkInternals.getResourceConcepts,
        { resourceId: embeddingDoc.resourceId }
      );

      const { overlap: conceptOverlap, sharedNames } = computeWeightedJaccard(
        sourceConcepts,
        candidateConcepts
      );

      const semanticSimilarity = candidate._score;

      let combinedScore: number;
      let meetsThreshold: boolean;

      if (conceptOverlap > 0) {
        combinedScore =
          CONCEPT_WEIGHT * conceptOverlap +
          SEMANTIC_WEIGHT * semanticSimilarity;
        meetsThreshold = combinedScore >= HYBRID_THRESHOLD;
      } else {
        combinedScore = semanticSimilarity;
        meetsThreshold = combinedScore >= SEMANTIC_ONLY_THRESHOLD;
      }

      if (meetsThreshold) {
        await ctx.runMutation(
          internal.resource.linkInternals.upsertResourceLink,
          {
            workspaceId: args.workspaceId,
            sourceResourceId: args.resourceId,
            targetResourceId: embeddingDoc.resourceId,
            score: combinedScore,
            conceptOverlap,
            semanticSimilarity,
            sharedConcepts: sharedNames,
            status: "auto",
          }
        );
      }
    }
  },
});

export const generateTagEmbedding = internalAction({
  args: {
    workspaceId: v.id("workspace"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return;
    }

    const provider = createOpenAIProvider(apiKey);
    const { embedding } = await generateEmbedding(provider, args.tagName);

    await ctx.runMutation(internal.resource.linkInternals.updateTagEmbedding, {
      workspaceId: args.workspaceId,
      name: args.tagName,
      embedding,
    });
  },
});

"use node";

import { createHash } from "node:crypto";
import { generateEmbedding } from "@strand/ai/embeddings";
import { createEnricher, type EnricherInput } from "@strand/ai/enrichment";
import { createOpenAIProvider } from "@strand/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
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

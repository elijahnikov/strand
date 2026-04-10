import { openai } from "@ai-sdk/openai";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { generateText, tool } from "ai";
import { z } from "zod";
import {
  fetchAuthAction,
  fetchAuthMutation,
  fetchAuthQuery,
} from "./auth-server";

interface ChunkResult {
  chunkId: string;
  chunkIndex: number;
  content: string;
  metadata?: { pageNumber?: number; sectionHeader?: string };
  resource: { _id: string; title: string; type: string };
  resourceId: string;
  score: number;
}

export interface RAGContext {
  chunks: ChunkResult[];
  scopedResource?: {
    title: string;
    type: string;
    summary?: string;
    content?: string;
  } | null;
}

export function createOpenAIModel() {
  return openai("gpt-4.1-mini");
}

export async function buildRAGContext(
  workspaceId: string,
  query: string,
  resourceId?: string
): Promise<RAGContext> {
  const chunks = (await fetchAuthAction(api.chat.actions.searchChunks, {
    workspaceId: workspaceId as Id<"workspace">,
    query,
    limit: 10,
  })) as ChunkResult[];

  let scopedResource: RAGContext["scopedResource"] = null;

  if (resourceId) {
    const resource = await fetchAuthQuery(api.resource.queries.get, {
      workspaceId: workspaceId as Id<"workspace">,
      resourceId: resourceId as Id<"resource">,
    });

    if (resource) {
      const noteContent =
        resource.type === "note" && "note" in resource
          ? (resource.note as { plainTextContent?: string } | undefined)
              ?.plainTextContent
          : undefined;

      const websiteContent =
        resource.type === "website" && "website" in resource
          ? (
              resource.website as
                | {
                    articleContent?: string;
                  }
                | undefined
            )?.articleContent
          : undefined;

      scopedResource = {
        title: resource.title,
        type: resource.type,
        summary: resource.resourceAI?.summary,
        content: (noteContent ?? websiteContent)?.slice(0, 4000),
      };
    }
  }

  return { chunks, scopedResource };
}

export function buildSystemPrompt(ragContext: RAGContext): string {
  const basePrompt = `You are a knowledgeable assistant for the user's personal knowledge library in Strand. You help users explore, understand, and connect their saved resources (articles, notes, files).

Rules:
- Ground your answers in the user's library content whenever possible.
- When mentioning a resource by name, use this syntax inline in your text: [[resource:RESOURCE_ID|Title|type]] — for example, write "I found relevant info in [[resource:abc123|My Article|website]] about..." instead of "I found relevant info in **My Article** about...". Never bold the title separately or add the reference at the end — always use the inline syntax wherever the title naturally appears in the sentence.
- Use the searchLibrary tool when the user asks about topics not covered in the provided context.
- Be concise but thorough.
- When you don't have enough context from the library, say so honestly.
- Format responses with markdown for readability.`;

  const sections: string[] = [basePrompt];

  if (ragContext.scopedResource) {
    const r = ragContext.scopedResource;
    sections.push(
      `\n## Current Resource\nTitle: ${r.title}\nType: ${r.type}${r.summary ? `\nSummary: ${r.summary}` : ""}${r.content ? `\nContent:\n${r.content}` : ""}`
    );
  }

  if (ragContext.chunks.length > 0) {
    sections.push("\n## Relevant Library Passages");
    for (const chunk of ragContext.chunks) {
      sections.push(
        `\n### ${chunk.resource.title} (${chunk.resource.type}) [ID: ${chunk.resourceId}]\n${chunk.content}`
      );
    }
  }

  return sections.join("\n");
}

export function createChatTools(workspaceId: string) {
  return {
    searchLibrary: tool({
      description:
        "Search the user's library for relevant resources and passages. Use this when the user asks about topics not covered in the provided context.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        limit: z
          .number()
          .describe("Max results to return, defaults to 5")
          .nullable(),
      }),
      execute: async ({ query, limit }) => {
        console.log("[tool:searchLibrary]", { query, limit });
        const effectiveLimit = limit ?? 10;
        const [chunks, titleMatches] = await Promise.all([
          fetchAuthAction(api.chat.actions.searchChunks, {
            workspaceId: workspaceId as Id<"workspace">,
            query,
            limit: effectiveLimit,
          }) as Promise<ChunkResult[]>,
          fetchAuthQuery(api.chat.queries.searchResources, {
            workspaceId: workspaceId as Id<"workspace">,
            query,
            limit: 10,
          }),
        ]);

        return {
          passages: chunks.map((c) => ({
            resourceId: c.resourceId,
            resourceTitle: c.resource.title,
            resourceType: c.resource.type,
            content: c.content,
            score: c.score,
          })),
          titleMatches: (
            titleMatches as Array<{
              _id: string;
              title: string;
              type: string;
            }>
          ).map((r) => ({
            resourceId: r._id,
            title: r.title,
            type: r.type,
          })),
        };
      },
    }),

    getResourceDetails: tool({
      description:
        "Get full details about a specific resource including its content and AI summary. IMPORTANT: Only use resourceId values that were returned by the searchLibrary tool or provided in the system prompt context (they look like 'k57abc...' format). Never guess or fabricate an ID.",
      inputSchema: z.object({
        resourceId: z
          .string()
          .describe("The exact resource ID from search results or context"),
      }),
      execute: async ({ resourceId }) => {
        console.log("[tool:getResourceDetails]", { resourceId });
        try {
          const resource = await fetchAuthQuery(api.resource.queries.get, {
            workspaceId: workspaceId as Id<"workspace">,
            resourceId: resourceId as Id<"resource">,
          });

          if (!resource) {
            return { error: "Resource not found" };
          }

          return {
            title: resource.title,
            type: resource.type,
            summary: resource.resourceAI?.summary,
            tags: resource.resourceAI?.tags,
          };
        } catch {
          return { error: "Invalid resource ID or resource not found" };
        }
      },
    }),
  };
}

export interface Citation {
  chunkIndex?: number;
  resourceId: string;
  snippet?: string;
  title: string;
  type: string;
}

export function extractCitations(ragContext: RAGContext): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();

  for (const chunk of ragContext.chunks) {
    if (seen.has(chunk.resourceId)) {
      continue;
    }
    seen.add(chunk.resourceId);
    citations.push({
      resourceId: chunk.resourceId,
      title: chunk.resource.title,
      type: chunk.resource.type,
      snippet: chunk.content.slice(0, 200),
      chunkIndex: chunk.chunkIndex,
    });
  }

  return citations;
}

export async function generateThreadTitle(
  userMessage: string,
  assistantMessage: string
): Promise<string> {
  const model = createOpenAIModel();
  const { text } = await generateText({
    model,
    system:
      "Generate a short, concise title (max 50 chars) for this conversation. Return ONLY the title text, no quotes or extra punctuation.",
    prompt: `User: ${userMessage.slice(0, 500)}\n\nAssistant: ${assistantMessage.slice(0, 500)}`,
  });
  return text.trim().slice(0, 60);
}

export async function saveAssistantMessage(
  workspaceId: string,
  threadId: string,
  content: string,
  citations: Citation[]
) {
  await fetchAuthMutation(api.chat.mutations.saveAssistantMessage, {
    workspaceId: workspaceId as Id<"workspace">,
    threadId: threadId as Id<"chatThread">,
    content,
    citations: citations.map((c) => ({
      resourceId: c.resourceId as Id<"resource">,
      title: c.title,
      type: c.type,
      snippet: c.snippet,
      chunkIndex: c.chunkIndex,
    })),
  });
}

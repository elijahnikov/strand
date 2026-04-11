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

## Resource Reference Syntax — CRITICAL

Whenever you mention any resource from the user's library, you MUST use this EXACT inline syntax with three pipe-separated fields:

[[resource:RESOURCE_ID|Title|type]]

- RESOURCE_ID is the ID provided in the context or returned by tools (looks like "k57abc123...").
- Title is the resource's exact title.
- type is one of: website, note, file.

EXAMPLES — these are ALL correct:
- "I found a great write-up in [[resource:k57abc|My Article|website]] about this."
- "Your note [[resource:k57def|Project Plan|note]] mentions the same topic."
- "This is covered in three places: [[resource:k57aaa|First|website]], [[resource:k57bbb|Second|note]], and [[resource:k57ccc|Third|file]]."

EXAMPLES — these are ALL WRONG, never do these:
- "Check out 'My Article'" — missing the [[resource:...]] wrapper
- "[[resource:k57abc|website]]" — missing the Title field
- "[My Article](resource://k57abc/website)" — wrong syntax, this is a markdown link
- "**My Article**" — bold instead of resource reference
- "the article (resource:k57abc)" — wrong format

Every single time you reference a saved resource, replace its title in your prose with the full [[resource:ID|Title|type]] syntax. Never write the title separately. Never use markdown links for library resources. Always include all three fields.

## Other Rules

- Ground your answers in the user's library content whenever possible.
- When the user references resources in their message using [[resource:ID|Title|type]], treat them as explicit references they want you to focus on. Use the getResourceDetails tool with the provided ID to fetch full details before answering.
- Use the searchLibrary tool when the user asks about topics not covered in the provided context.
- Be concise but thorough.
- When you don't have enough context from the library, say so honestly.
- Format the rest of your response with markdown for readability (headings, lists, code blocks, etc.).`;

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

          // Extract the actual content based on resource type
          let content: string | undefined;
          if (resource.type === "website" && "website" in resource) {
            const website = resource.website as
              | { articleContent?: string; ogDescription?: string }
              | undefined;
            content = website?.articleContent ?? website?.ogDescription;
          } else if (resource.type === "note" && "note" in resource) {
            const note = resource.note as
              | { plainTextContent?: string }
              | undefined;
            content = note?.plainTextContent;
          } else if (resource.type === "file" && "file" in resource) {
            const file = resource.file as
              | { extractedText?: string }
              | undefined;
            content = file?.extractedText;
          }

          return {
            title: resource.title,
            type: resource.type,
            summary: resource.resourceAI?.summary,
            tags: resource.resourceAI?.tags,
            // Cap content at ~8000 chars to keep token usage reasonable
            content: content?.slice(0, 8000),
            hasContent: Boolean(content),
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

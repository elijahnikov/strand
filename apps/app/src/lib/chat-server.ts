import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  generateText,
  jsonSchema,
  type LanguageModel,
  type ToolSet,
  tool,
} from "ai";
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
  return openai("gpt-4o-mini");
}

type ResolvedChatProvider =
  | { provider: "platform"; model: null; apiKey: null }
  | {
      provider: "openai" | "google" | "anthropic";
      model: string;
      apiKey: string;
    };

/**
 * Resolves the workspace's configured AI provider (platform default or BYO
 * key) and returns the ai-sdk model plus its identifier. The identifier is
 * persisted in the credit ledger so usage rows carry the exact model name
 * used for the turn.
 */
export async function getChatModel(workspaceId: string): Promise<{
  model: LanguageModel;
  modelId: string;
}> {
  const resolved = (await fetchAuthAction(
    api.billing.byoKeyActions.resolveAIProvider,
    { workspaceId: workspaceId as Id<"workspace"> }
  )) as ResolvedChatProvider;

  if (resolved.provider === "platform") {
    const modelId = "gpt-4o-mini";
    return { model: openai(modelId), modelId };
  }
  const modelId = resolved.model;
  if (resolved.provider === "openai") {
    const provider = createOpenAI({ apiKey: resolved.apiKey });
    return { model: provider(modelId), modelId };
  }
  if (resolved.provider === "anthropic") {
    const provider = createAnthropic({ apiKey: resolved.apiKey });
    return { model: provider(modelId), modelId };
  }
  const provider = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
  return { model: provider(modelId), modelId };
}

const RAG_CHUNK_LIMIT = 5;

export async function buildRAGContext(
  workspaceId: string,
  query: string,
  resourceId?: string
): Promise<RAGContext> {
  const chunks = (await fetchAuthAction(api.chat.actions.searchChunks, {
    workspaceId: workspaceId as Id<"workspace">,
    query,
    limit: RAG_CHUNK_LIMIT,
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

export interface ExternalToolSummary {
  description: string | null;
  name: string;
  serverInstructions: string | null;
  serverName: string;
}

export function buildSystemPrompt(
  ragContext: RAGContext,
  memory: string | null,
  externalTools: ExternalToolSummary[] = []
): string {
  const basePrompt = `You are a knowledgeable assistant for the user's personal knowledge library in omi. You help users explore, understand, and connect their saved resources (articles, notes, files).

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
- "...as covered here:\\n\\n[[resource:k57abc|My Article|website]]\\n." — NEVER put the reference on its own line. NEVER let punctuation dangle on a line by itself. The reference must sit INSIDE a sentence.

CRITICAL placement rules:
- The reference must be inline within a sentence — surrounded by words on both sides.
- Punctuation (period, comma, etc.) goes IMMEDIATELY after the closing ]] with no line break, like: "...as practiced in [[resource:k57abc|My Article|website]]." — note the period directly after ]].
- Never insert a blank line before or after a [[resource:...]] reference unless it's the only content in the sentence.

Every single time you reference a saved resource, replace its title in your prose with the full [[resource:ID|Title|type]] syntax. Never write the title separately. Never use markdown links for library resources. Always include all three fields. Always inline the reference within a sentence.

## Other Rules

- For questions about the user's library, ground your answers in their saved resources.
- For questions about a connected external service (Linear, Calendar, etc., listed below if any), CALL the relevant external tool — do NOT tell the user to check that service themselves.
- When the user references resources in their message using [[resource:ID|Title|type]], treat them as explicit references they want you to focus on. Use the getResourceDetails tool with the provided ID to fetch full details before answering.
- Use the searchLibrary tool when the user asks about topics not covered in the provided context.
- Be concise but thorough.
- When you don't have enough context from the library or any external tool, say so honestly.
- Format the rest of your response with markdown for readability (headings, lists, code blocks, etc.).

## Creating Collections

When the user explicitly asks you to **create**, **build**, **group**, **organize**, or **collect** resources into a collection, do NOT just describe what you would create. Instead:
1. Call \`searchLibrary\` to find candidate resources for the topic (use a generous limit, e.g. 20).
2. Call \`proposeCollection\` with a clear, concise name (no quotes, no emojis), the chosen resourceIds (max 25), and a one-sentence reason for the grouping.
3. After calling \`proposeCollection\`, write ONE short sentence telling the user the proposal is ready below — do NOT re-list the resources in your text (the UI will render them as a confirmation card).

Never call \`proposeCollection\` without first calling \`searchLibrary\` in the same turn. Never invent resourceIds — only pass IDs returned by \`searchLibrary\` or present in the system prompt context. If \`searchLibrary\` returns zero matches, say so plainly and do NOT call \`proposeCollection\`.`;

  const sections: string[] = [basePrompt];

  if (memory && memory.trim().length > 0) {
    sections.push(
      `\n## About This User\nA persistent profile built from prior conversations. Treat it as background context — the user did not re-say it this turn. Do not restate or summarize it unless asked.\n\n${memory.trim()}`
    );
  }

  if (ragContext.scopedResource) {
    const r = ragContext.scopedResource;
    sections.push(
      `\n## Current Resource\nTitle: ${r.title}\nType: ${r.type}${r.summary ? `\nSummary: ${r.summary}` : ""}${r.content ? `\nContent:\n${r.content}` : ""}`
    );
  }

  if (externalTools.length > 0) {
    const grouped = new Map<
      string,
      { instructions: string | null; tools: ExternalToolSummary[] }
    >();
    for (const tool of externalTools) {
      const entry = grouped.get(tool.serverName) ?? {
        instructions: tool.serverInstructions,
        tools: [],
      };
      entry.tools.push(tool);
      grouped.set(tool.serverName, entry);
    }
    const lines: string[] = [
      "\n## Connected External Tools",
      "The user has connected external services (via MCP) whose tools are available to you. Prefer these tools when the user's question is about that service — don't tell them to check the dashboard themselves. Tool names are namespaced `mcp__<service>__<action>`.",
      "",
      "**Argument minimalism — STRICT, READ THIS:**",
      "Tool schemas list every argument the tool CAN accept, including many optional filters. Most calls should pass FEW arguments — only the ones the user actually mentioned, plus required ones.",
      "",
      "Specifically:",
      "- DO NOT fill in optional filter fields (`priority`, `state`, `team`, `project`, `assignee`, `owner`, `cycle`, `label`, `delegate`, `cursor`, `parentId`, `createdAt`, `updatedAt`, `query`, etc.) unless the user asked to filter on them. OMIT them entirely.",
      "- DO NOT invent IDs, slugs, names, or enum values from the user's message. If you don't have a verified value (returned by another tool call this turn), omit the field — the API will use its default.",
      '- 0, `"all"`, `"any"`, `"none"`, `"null"`, `""` are FILTER VALUES, not "no filter". They RESTRICT results. To get unfiltered results, OMIT THE FIELD.',
      "",
      "Example — user asks 'list my Linear issues':",
      '- WRONG: `list_issues({ assignee: "me", team: "my-workspace", state: "all", priority: 0, ... })` — every filter is a guess.',
      "- RIGHT: `list_issues({ limit: 50 })` — pass only required args; let the server default to everything.",
      "",
      "**For 'my X' queries**: prefer tools whose name contains `me`, `my`, `whoami`, `viewer`, or `current_user`. Otherwise, OMIT user-filter args — most APIs default to the authenticated user. Never pass the literal string `\"me\"` as a user ID.",
      "",
      "**For ID/slug filters** (team, project, workspace, etc.): if you don't already have a real ID returned by another tool, either (a) call a `list_*` enumerator tool first, or (b) omit the filter and let the server return everything.",
      "",
      "**Empty results aren't an answer**: if a list call returns zero items unexpectedly, RETRY ONCE with FEWER filters (or none) before reporting empty.",
    ];
    // We list tool NAMES only here — full descriptions are already delivered
    // to the model via each tool definition. Listing the names alongside
    // their server is what nudges the model to call them. Descriptions can
    // be 1-2KB each (Notion); duplicating them would inflate the prompt
    // by tens of KB.
    for (const [serverName, entry] of grouped) {
      lines.push(`\n**${serverName}** (${entry.tools.length} tools):`);
      if (entry.instructions) {
        lines.push(`*Server guidance:* ${entry.instructions}`);
      }
      lines.push(entry.tools.map((t) => `\`${t.name}\``).join(", "));
    }
    sections.push(lines.join("\n"));
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

    proposeCollection: tool({
      description:
        "Propose a new collection containing a set of resources from the user's library. Use this AFTER calling searchLibrary when the user asks you to create, build, group, or organize resources into a collection. This does NOT create the collection — it returns a structured proposal that the user will confirm via a UI card with a Create button. Only pass resourceIds you have seen returned by searchLibrary or present in the system prompt context. Limit resourceIds to at most 25. The name must be plain text — no emojis or icons.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            "Suggested collection name in plain text — no emojis. e.g. 'React performance articles'"
          ),
        resourceIds: z
          .array(z.string())
          .describe(
            "Resource IDs to include in the collection (from searchLibrary results)"
          ),
        reason: z
          .string()
          .describe(
            "One short sentence explaining why these resources were chosen"
          ),
      }),
      execute: async ({ name, resourceIds, reason }) => {
        console.log("[tool:proposeCollection]", {
          name,
          count: resourceIds.length,
        });
        const resources: Array<{ id: string; title: string; type: string }> =
          [];
        for (const id of resourceIds.slice(0, 25)) {
          try {
            const r = await fetchAuthQuery(api.resource.queries.get, {
              workspaceId: workspaceId as Id<"workspace">,
              resourceId: id as Id<"resource">,
            });
            if (r) {
              resources.push({ id: r._id, title: r.title, type: r.type });
            }
          } catch {
            // skip invalid ids
          }
        }

        return {
          name,
          reason,
          resources,
          resourceIds: resources.map((r) => r.id),
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

/**
 * Pull the user's connected MCP servers' enabled tools and wrap each as an
 * ai-sdk tool whose `execute()` proxies the call to the Convex MCP client
 * action. Tool names are namespaced `mcp__<serverName>__<toolName>` to avoid
 * collisions with native tools and across multiple connected servers.
 *
 * Returns a tools record (possibly empty) plus the set of namespaced tool
 * names so the caller can extend `PERSISTED_TOOL_NAMES` for replay rendering.
 */
export async function createMcpToolsForChat(): Promise<{
  tools: ToolSet;
  toolNames: Set<string>;
  toolSummaries: ExternalToolSummary[];
}> {
  let enabled: Array<{
    serverId: Id<"mcpServer">;
    serverName: string;
    serverInstructions: string | null;
    toolName: string;
    description: string | null;
    inputSchema: string;
  }>;
  try {
    enabled = (await fetchAuthQuery(
      api.mcpClient.queries.listEnabledToolsForChat,
      {}
    )) as typeof enabled;
  } catch (err) {
    console.error(
      "[createMcpToolsForChat] listEnabledToolsForChat failed:",
      err
    );
    enabled = [];
  }

  const tools: ToolSet = {};
  const toolNames = new Set<string>();
  const toolSummaries: ExternalToolSummary[] = [];

  for (const entry of enabled) {
    const namespacedName = mcpToolName(entry.serverName, entry.toolName);
    toolNames.add(namespacedName);
    toolSummaries.push({
      name: namespacedName,
      serverName: entry.serverName,
      description: entry.description,
      serverInstructions: entry.serverInstructions,
    });

    tools[namespacedName] = tool({
      description: entry.description
        ? `[${entry.serverName}] ${entry.description}`
        : `Tool '${entry.toolName}' from ${entry.serverName}`,
      inputSchema: jsonSchema(
        parseInputSchemaJson(entry.inputSchema) as Parameters<
          typeof jsonSchema
        >[0]
      ),
      execute: async (args) => {
        console.log("[tool:mcp]", {
          server: entry.serverName,
          tool: entry.toolName,
        });
        return (await fetchAuthAction(api.mcpClient.callAction.callTool, {
          serverId: entry.serverId,
          toolName: entry.toolName,
          args,
        })) as {
          content: Array<{ type: string; text?: string; [k: string]: unknown }>;
          isError?: boolean;
        };
      },
    });
  }

  return { tools, toolNames, toolSummaries };
}

function parseInputSchemaJson(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return { type: "object", properties: {} };
  }
}

const MCP_TOOL_PREFIX = "mcp__";
const NON_ALNUM_RE = /[^a-zA-Z0-9_]/g;

function mcpToolName(serverName: string, toolName: string): string {
  const safeServer = serverName.replace(NON_ALNUM_RE, "_").slice(0, 32);
  const safeTool = toolName.replace(NON_ALNUM_RE, "_").slice(0, 64);
  return `${MCP_TOOL_PREFIX}${safeServer}__${safeTool}`;
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
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system:
      "Generate a short, concise title (max 50 chars) for this conversation. Return ONLY the title text, no quotes or extra punctuation.",
    prompt: `User: ${userMessage.slice(0, 500)}\n\nAssistant: ${assistantMessage.slice(0, 500)}`,
  });
  return text.trim().slice(0, 60);
}

/**
 * A persisted tool part shaped to match an AI SDK v6 UIMessage tool part.
 * Stored opaquely on the chatMessage so adding new tools requires no schema
 * changes. Tool-specific UI components read their own `output` shape.
 */
export interface PersistedToolPart {
  input?: unknown;
  output: unknown;
  state: "output-available";
  toolCallId: string;
  type: string; // e.g. "tool-proposeCollection"
}

export async function saveAssistantMessage(
  workspaceId: string,
  threadId: string,
  content: string,
  citations: Citation[],
  toolParts?: PersistedToolPart[]
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
    toolParts: toolParts && toolParts.length > 0 ? toolParts : undefined,
  });
}

interface MaybeToolResult {
  input?: unknown;
  output?: unknown;
  result?: unknown;
  toolCallId?: string;
  toolName?: string;
}

interface MaybeStep {
  toolResults?: MaybeToolResult[];
}

/**
 * Walk every step's `toolResults` and shape each one as a UIMessage tool part
 * suitable for persistence. Generic — adds nothing tool-specific. Filtering
 * (e.g. "only persist these tools") happens via the `toolNames` allowlist.
 */
export function extractToolPartsFromSteps(
  steps: unknown,
  toolNames?: ReadonlySet<string>
): PersistedToolPart[] {
  if (!Array.isArray(steps)) {
    return [];
  }
  const parts: PersistedToolPart[] = [];
  for (const step of steps as MaybeStep[]) {
    const toolResults = step?.toolResults;
    if (!Array.isArray(toolResults)) {
      continue;
    }
    for (const tr of toolResults) {
      if (
        typeof tr.toolName !== "string" ||
        typeof tr.toolCallId !== "string"
      ) {
        continue;
      }
      if (toolNames && !toolNames.has(tr.toolName)) {
        continue;
      }
      parts.push({
        type: `tool-${tr.toolName}`,
        state: "output-available",
        toolCallId: tr.toolCallId,
        input: tr.input,
        output: tr.output ?? tr.result,
      });
    }
  }
  return parts;
}

/**
 * Tools whose results we want to persist & re-render when the user reloads
 * the chat thread. Add new entries here as new interactive tools are built.
 */
export const PERSISTED_TOOL_NAMES: ReadonlySet<string> = new Set([
  "proposeCollection",
]);

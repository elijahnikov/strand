import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import { rateLimiter } from "../rateLimiter";

const BEARER_PREFIX = "Bearer ";
const PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "omi";
const SERVER_VERSION = "0.1.0";

type ToolName =
  | "save_resource"
  | "search_library"
  | "list_collections"
  | "get_resource";

interface JsonRpcRequest {
  id?: string | number | null;
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

interface ResolvedMcpAuth {
  tokenId: Id<"extensionToken">;
  userId: Id<"user">;
  workspaceId: Id<"workspace">;
}

class McpError extends Error {
  readonly code: number;
  readonly httpStatus: number;

  constructor(code: number, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function jsonRpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  httpStatus = 200
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  // Signal bearer-only auth so spec-compliant MCP clients don't fall through
  // to OAuth 2.1 dynamic client registration on 401. The realm gives clients
  // a hint about where to obtain tokens.
  if (httpStatus === 401) {
    headers["www-authenticate"] = 'Bearer realm="omi", error="invalid_token"';
  }
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { status: httpStatus, headers }
  );
}

async function authenticate(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request
): Promise<ResolvedMcpAuth> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) {
    throw new McpError(-32_001, "Missing bearer token", 401);
  }
  const token = header.slice(BEARER_PREFIX.length).trim();

  const resolved = await ctx.runQuery(
    internal.extensionAuth.internals.resolveByToken,
    { token }
  );
  if (!resolved || resolved.kind !== "mcp") {
    throw new McpError(-32_001, "Invalid or expired token", 401);
  }
  if (!resolved.defaultWorkspaceId) {
    throw new McpError(-32_002, "Token is not bound to a workspace", 400);
  }

  const member = await ctx.runQuery(internal.mcp.internals.validateMembership, {
    workspaceId: resolved.defaultWorkspaceId,
    userId: resolved.userId,
  });
  if (!member) {
    throw new McpError(-32_003, "No longer a member of this workspace", 403);
  }

  await ctx.runMutation(internal.extensionAuth.internals.touchLastUsed, {
    tokenId: resolved.tokenId,
  });

  return {
    userId: resolved.userId,
    workspaceId: resolved.defaultWorkspaceId,
    tokenId: resolved.tokenId,
  };
}

const TOOL_DEFINITIONS: ReadonlyArray<{
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  {
    name: "save_resource",
    description:
      "Save something to the user's Omi library. Pass `url` for a webpage or `content` for a note — everything else is optional and will be derived. Use this whenever the user asks to save, capture, archive, bookmark, or remember something in Omi.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "URL to save as a website resource. Provide this OR `content`, not both.",
        },
        content: {
          type: "string",
          description:
            "Plain text body to save as a note. Provide this OR `url`, not both.",
        },
        title: {
          type: "string",
          description:
            "Optional. Display title. If omitted, derived from the URL (websites get a real title later via metadata extraction) or the first line of content (notes).",
        },
        description: {
          type: "string",
          description: "Optional short description.",
        },
        collectionId: {
          type: "string",
          description:
            "Optional. Collection ID to file the resource into. Call list_collections first to look up valid IDs.",
        },
      },
    },
  },
  {
    name: "search_library",
    description:
      "Search the user's Omi library for resources relevant to a query. Returns semantic matches against resource content (RAG passages) and title matches. Use this to pull Omi context into your answers.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language search query.",
        },
        limit: {
          type: "number",
          description: "Max results to return (1-20). Defaults to 10.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_collections",
    description:
      "List all collections (folders) in the connected Omi workspace. Returns collection IDs and names. Use before save_resource if the user wants the resource filed into a specific collection.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_resource",
    description:
      "Fetch a single resource's full content (up to 8k chars), AI-generated summary, and tags by ID. Use after search_library to drill into a specific result.",
    inputSchema: {
      type: "object",
      properties: {
        resourceId: {
          type: "string",
          description: "Resource ID from search_library.",
        },
      },
      required: ["resourceId"],
    },
  },
];

function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

const NOTE_TITLE_MAX_LEN = 60;

function deriveNoteTitle(content: string): string {
  const firstLine = content.split("\n", 1)[0]?.trim() ?? "";
  if (firstLine.length === 0) {
    return "Untitled note";
  }
  if (firstLine.length <= NOTE_TITLE_MAX_LEN) {
    return firstLine;
  }
  return `${firstLine.slice(0, NOTE_TITLE_MAX_LEN).trimEnd()}…`;
}

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

async function callTool(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  auth: ResolvedMcpAuth,
  name: string,
  rawArgs: unknown
): Promise<unknown> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  switch (name) {
    case "save_resource": {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      const content =
        typeof args.content === "string" ? args.content : undefined;
      const explicitTitle =
        typeof args.title === "string" ? args.title.trim() : "";
      const description =
        typeof args.description === "string" ? args.description : undefined;
      const collectionId =
        typeof args.collectionId === "string"
          ? (args.collectionId as Id<"collection">)
          : undefined;

      if (url && content) {
        throw new McpError(
          -32_602,
          "Provide either `url` or `content`, not both"
        );
      }

      if (url) {
        const resourceId = await ctx.runMutation(
          internal.resource.internals.createForUser,
          {
            workspaceId: auth.workspaceId,
            userId: auth.userId,
            type: "website",
            title: explicitTitle || url,
            description,
            url,
            collectionId,
          }
        );
        return textContent(
          `Saved ${url} as resource ${resourceId}. The real page title and metadata will populate within seconds.`
        );
      }

      if (content !== undefined && content.trim().length > 0) {
        const resourceId = await ctx.runMutation(
          internal.resource.internals.createForUser,
          {
            workspaceId: auth.workspaceId,
            userId: auth.userId,
            type: "note",
            title: explicitTitle || deriveNoteTitle(content),
            description,
            plainTextContent: content,
            collectionId,
          }
        );
        return textContent(`Saved note as resource ${resourceId}.`);
      }

      throw new McpError(-32_602, "Provide either `url` or `content`");
    }

    case "search_library": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) {
        throw new McpError(-32_602, "query is required");
      }
      const requestedLimit =
        typeof args.limit === "number" ? Math.floor(args.limit) : 10;
      const limit = Math.max(1, Math.min(20, requestedLimit));

      const [passages, titleHits] = await Promise.all([
        ctx.runAction(internal.mcp.searchAction.searchLibraryForUser, {
          workspaceId: auth.workspaceId,
          userId: auth.userId,
          query,
          limit,
        }),
        ctx.runQuery(internal.mcp.internals.searchTitleHits, {
          workspaceId: auth.workspaceId,
          query,
          limit,
        }),
      ]);

      return jsonContent({ passages, titleMatches: titleHits });
    }

    case "list_collections": {
      const collections = await ctx.runQuery(
        internal.mcp.internals.listCollections,
        { workspaceId: auth.workspaceId }
      );
      return jsonContent({ collections });
    }

    case "get_resource": {
      const resourceId =
        typeof args.resourceId === "string" ? args.resourceId : "";
      if (!resourceId) {
        throw new McpError(-32_602, "resourceId is required");
      }
      const resource = await ctx.runQuery(internal.mcp.internals.getResource, {
        workspaceId: auth.workspaceId,
        resourceId: resourceId as Id<"resource">,
      });
      if (!resource) {
        throw new McpError(-32_004, "Resource not found");
      }
      return jsonContent(resource);
    }

    default:
      throw new McpError(-32_601, `Unknown tool: ${name}`);
  }
}

async function dispatch(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  auth: ResolvedMcpAuth,
  message: JsonRpcRequest
): Promise<Response> {
  const id = message.id;

  if (message.method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
  }

  if (message.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (message.method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (message.method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOL_DEFINITIONS });
  }

  if (message.method === "tools/call") {
    const params = (message.params ?? {}) as {
      name?: string;
      arguments?: unknown;
    };
    if (typeof params.name !== "string") {
      return jsonRpcError(id, -32_602, "Missing tool name");
    }
    try {
      const result = await callTool(ctx, auth, params.name, params.arguments);
      return jsonRpcResult(id, result);
    } catch (err) {
      if (err instanceof McpError) {
        return jsonRpcResult(id, {
          ...textContent(err.message),
          isError: true,
        });
      }
      if (err instanceof ConvexError) {
        const data = err.data as
          | { kind?: string; retryAfter?: number }
          | string;
        if (
          typeof data === "object" &&
          data !== null &&
          data.kind === "RateLimited"
        ) {
          return jsonRpcResult(id, {
            ...textContent(
              `Rate limit exceeded. Retry after ${Math.ceil((data.retryAfter ?? 0) / 1000)}s.`
            ),
            isError: true,
          });
        }
        return jsonRpcResult(id, {
          ...textContent(typeof data === "string" ? data : "Tool call failed"),
          isError: true,
        });
      }
      const message_ = err instanceof Error ? err.message : "Tool call failed";
      return jsonRpcResult(id, {
        ...textContent(message_),
        isError: true,
      });
    }
  }

  return jsonRpcError(id, -32_601, `Method not found: ${message.method}`);
}

export const mcpHandler = httpAction(async (ctx, request) => {
  if (request.method === "GET" || request.method === "DELETE") {
    // Streamable HTTP allows GET (open SSE stream) and DELETE (terminate
    // session). v1 is stateless: every POST stands alone, so we just
    // acknowledge these without doing anything.
    return new Response(null, { status: 200 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let auth: ResolvedMcpAuth;
  try {
    auth = await authenticate(ctx, request);
  } catch (err) {
    if (err instanceof McpError) {
      return jsonRpcError(null, err.code, err.message, err.httpStatus);
    }
    return jsonRpcError(null, -32_603, "Internal error", 500);
  }

  try {
    await rateLimiter.limit(ctx, "chatSearch", {
      key: auth.tokenId,
      throws: true,
    });
  } catch (err) {
    if (err instanceof ConvexError) {
      const data = err.data as { kind?: string; retryAfter?: number } | string;
      if (
        typeof data === "object" &&
        data !== null &&
        data.kind === "RateLimited"
      ) {
        const retryAfter = data.retryAfter ?? 0;
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32_005, message: "Rate limit exceeded" },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": String(Math.ceil(retryAfter / 1000)),
            },
          }
        );
      }
    }
  }

  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32_700, "Parse error", 400);
  }

  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return jsonRpcError(message?.id ?? null, -32_600, "Invalid request", 400);
  }

  return await dispatch(ctx, auth, message);
});

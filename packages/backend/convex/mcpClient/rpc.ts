"use node";

/**
 * Minimal MCP client over Streamable HTTP.
 *
 * Speaks JSON-RPC 2.0 against an external MCP server's single endpoint. We
 * support exactly the subset Omi's chat needs:
 *   - `initialize`         (one-shot handshake; called implicitly when needed)
 *   - `tools/list`         (cached at connect-time and on user-triggered refresh)
 *   - `tools/call`         (the hot path: invoked from chat tool execute())
 *
 * Stateless: every request stands alone with the bearer in the Authorization
 * header. No session resumption, no SSE streaming. Most servers accept this.
 */

const PROTOCOL_VERSION = "2025-03-26";
const CLIENT_INFO = { name: "omi", version: "0.1.0" };
const REQUEST_TIMEOUT_MS = 30_000;

export interface McpToolDefinition {
  description?: string;
  inputSchema: unknown;
  name: string;
}

export interface McpContentBlock {
  data?: unknown;
  text?: string;
  type: string;
  [key: string]: unknown;
}

export interface McpToolCallResult {
  content: McpContentBlock[];
  isError?: boolean;
}

export class McpRpcError extends Error {
  readonly status?: number;
  readonly code?: number;
  readonly isAuthError: boolean;

  constructor(
    message: string,
    options: { status?: number; code?: number; isAuthError?: boolean } = {}
  ) {
    super(message);
    this.status = options.status;
    this.code = options.code;
    this.isAuthError = options.isAuthError ?? false;
  }
}

interface RpcOptions {
  bearerToken?: string;
  /** Extra headers beyond Authorization. */
  headers?: Record<string, string>;
  /** Mcp-Session-Id from a prior initialize response, if the server uses
   * sessioned Streamable HTTP (Notion, Atlassian, etc.). */
  sessionId?: string;
  url: string;
}

const SESSION_HEADER = "Mcp-Session-Id";

let nextId = 1;
function newRequestId(): number {
  nextId += 1;
  return nextId;
}

interface RpcResult<T> {
  result: T;
  /** The session id the server returned via Mcp-Session-Id, if any. */
  sessionId?: string;
}

async function rpc<T>(
  method: string,
  params: Record<string, unknown> | undefined,
  options: RpcOptions
): Promise<RpcResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(options.headers ?? {}),
  };
  if (options.bearerToken) {
    headers.authorization = `Bearer ${options.bearerToken}`;
  }
  if (options.sessionId) {
    headers[SESSION_HEADER] = options.sessionId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(options.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: newRequestId(),
        method,
        params,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new McpRpcError(
        `MCP request timed out after ${REQUEST_TIMEOUT_MS}ms`
      );
    }
    throw new McpRpcError(
      err instanceof Error ? err.message : "MCP request failed"
    );
  }
  clearTimeout(timeout);

  if (response.status === 401 || response.status === 403) {
    throw new McpRpcError(
      `MCP server rejected credentials (${response.status})`,
      {
        status: response.status,
        isAuthError: true,
      }
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new McpRpcError(
      `MCP server returned ${response.status}: ${text.slice(0, 200)}`,
      { status: response.status }
    );
  }

  // Many servers return SSE for streamable HTTP; for now we read the response
  // as text and pull out the first JSON-RPC payload either way.
  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    payload = parseFirstSseDataLine(text);
  } else {
    const text = await response.text();
    try {
      payload = JSON.parse(text);
    } catch {
      throw new McpRpcError(
        `MCP server returned non-JSON response: ${text.slice(0, 200)}`
      );
    }
  }

  const envelope = payload as {
    error?: { code: number; message: string };
    result?: T;
  };
  if (envelope.error) {
    throw new McpRpcError(envelope.error.message, {
      code: envelope.error.code,
    });
  }
  if (envelope.result === undefined) {
    throw new McpRpcError("MCP response missing `result`");
  }
  const sessionId =
    response.headers.get(SESSION_HEADER) ??
    response.headers.get(SESSION_HEADER.toLowerCase()) ??
    undefined;
  return { result: envelope.result, sessionId };
}

const DATA_LINE_PREFIX = "data: ";

function parseFirstSseDataLine(text: string): unknown {
  for (const line of text.split("\n")) {
    if (line.startsWith(DATA_LINE_PREFIX)) {
      const data = line.slice(DATA_LINE_PREFIX.length).trim();
      if (data.length > 0) {
        try {
          return JSON.parse(data);
        } catch {
          // Fall through to next line
        }
      }
    }
  }
  throw new McpRpcError("MCP SSE response had no parseable data line");
}

export interface McpInitializeResult {
  instructions?: string;
  serverInfo?: { name?: string; version?: string };
  /** Returned only by servers that use sessioned Streamable HTTP. Subsequent
   * requests in the same conversation must echo it back as `Mcp-Session-Id`. */
  sessionId?: string;
}

/**
 * Best-effort `initialize` handshake. Required by some servers (Notion,
 * Atlassian, anyone using sessioned Streamable HTTP); harmless on others.
 *
 * Captures the optional `instructions` field — server authors use it to
 * describe how their tools should be used, which we inject into the chat
 * system prompt only when that server is connected — and the
 * `Mcp-Session-Id` response header for sessioned servers.
 */
export async function mcpInitialize(
  options: RpcOptions
): Promise<McpInitializeResult> {
  const { result, sessionId } = await rpc<McpInitializeResult>(
    "initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
    options
  );
  return { ...result, sessionId };
}

export async function mcpToolsList(
  options: RpcOptions
): Promise<McpToolDefinition[]> {
  const { result } = await rpc<{ tools: McpToolDefinition[] }>(
    "tools/list",
    {},
    options
  );
  return result.tools ?? [];
}

export async function mcpToolsCall(
  options: RpcOptions,
  name: string,
  args: Record<string, unknown>
): Promise<McpToolCallResult> {
  const { result } = await rpc<McpToolCallResult>(
    "tools/call",
    { name, arguments: args },
    options
  );
  return result;
}

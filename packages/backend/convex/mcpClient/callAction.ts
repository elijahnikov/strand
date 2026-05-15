"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { decryptToken } from "../connections/tokens";
import { rateLimiter } from "../rateLimiter";
import { getAuthIdentity } from "../utils";
import {
  McpRpcError,
  type McpToolCallResult,
  mcpInitialize,
  mcpToolsCall,
} from "./rpc";

const REFRESH_BUFFER_MS = 60_000;

/**
 * Some MCP servers (Notion, Atlassian) require a session: `initialize` returns
 * an `Mcp-Session-Id` header that must accompany every subsequent request.
 * We don't persist sessions yet — we re-initialize when the server tells us
 * we need one. First call without session; if the server rejects with a
 * "session required" error, initialize and retry once with the new session.
 */
async function callToolWithSessionRetry(
  baseOptions: { url: string; bearerToken: string },
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<McpToolCallResult> {
  try {
    return await mcpToolsCall(baseOptions, toolName, toolArgs);
  } catch (err) {
    if (!(err instanceof McpRpcError) || !isSessionRequiredError(err)) {
      throw err;
    }
    const init = await mcpInitialize(baseOptions);
    if (!init.sessionId) {
      throw err;
    }
    return await mcpToolsCall(
      { ...baseOptions, sessionId: init.sessionId },
      toolName,
      toolArgs
    );
  }
}

function isSessionRequiredError(err: McpRpcError): boolean {
  if (err.status === 400 && /session/i.test(err.message)) {
    return true;
  }
  if (err.code === -32_000 && /session/i.test(err.message)) {
    return true;
  }
  return false;
}

/**
 * Strip arguments the model commonly fills in when it shouldn't, instead of
 * leaving optional fields off:
 *   - the literal string "null" (model interprets nullable schema defaults
 *     as the string "null", not omission)
 *   - the literal string "undefined"
 *   - empty strings (most servers treat absence and "" differently;
 *     omission is almost always correct)
 *   - actual `null` / `undefined` values
 *
 * Applied recursively for nested objects so a `filter: { project: "null" }`
 * doesn't leak through.
 */
function sanitizeToolArgs(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const cleaned = sanitizeValue(value);
    if (cleaned !== SENTINEL_OMIT) {
      out[key] = cleaned;
    }
  }
  return out;
}

const SENTINEL_OMIT = Symbol("omit");

/**
 * Drop arguments that, across virtually all MCP servers, are model
 * hallucinations rather than user intent. These aren't tool-specific —
 * they're patterns of how models misuse permissive JSON schemas:
 *
 *   - `priority: 0` — issue trackers universally use 0/no-priority as a
 *     real filter value, not "no filter". Models fill it in as a default.
 *   - common filter values that the model treats as "give me everything"
 *     but the API treats as restrictive ("all", "any", "none") — applied
 *     only to fields whose name suggests a single-value filter, not a
 *     verb arg.
 *
 * Far cheaper than reasoning each time — and the system prompt already
 * tells the model not to do this; this is the safety net.
 */
function dropAntiPatternFilters(input: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(input)) {
    if (key.toLowerCase() === "priority" && value === 0) {
      delete input[key];
      continue;
    }
    if (
      typeof value === "string" &&
      ANTI_PATTERN_FILTER_VALUES.has(value.trim().toLowerCase()) &&
      ANTI_PATTERN_FILTER_KEYS.test(key)
    ) {
      delete input[key];
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      dropAntiPatternFilters(value as Record<string, unknown>);
    }
  }
}

const ANTI_PATTERN_FILTER_VALUES = new Set(["all", "any", "none"]);
const ANTI_PATTERN_FILTER_KEYS =
  /^(state|status|type|category|kind|filter|scope)$/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return SENTINEL_OMIT;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
      return SENTINEL_OMIT;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => sanitizeValue(v))
      .filter((v) => v !== SENTINEL_OMIT);
    return arr;
  }
  if (typeof value === "object") {
    const cleaned = sanitizeToolArgs(value as Record<string, unknown>);
    return cleaned;
  }
  return value;
}

interface ServerForCall {
  _id: Id<"mcpServer">;
  accessTokenExpiresAt?: number;
  authType: "bearer" | "oauth2";
  enabledTools: string[];
  encryptedAccessToken?: string;
  tokenKeyVersion?: number;
  url: string;
  userId: Id<"user">;
}

async function loadActiveBearer(
  ctx: ActionCtx,
  serverId: Id<"mcpServer">
): Promise<{ server: ServerForCall; bearer: string }> {
  let server = (await ctx.runQuery(
    internal.mcpClient.internals.getServerForCall,
    { serverId }
  )) as ServerForCall | null;
  if (!server) {
    throw new ConvexError("MCP server not found");
  }
  if (
    server.authType === "oauth2" &&
    server.accessTokenExpiresAt !== undefined &&
    server.accessTokenExpiresAt - Date.now() < REFRESH_BUFFER_MS
  ) {
    await ctx.runAction(internal.mcpClient.oauthActions.refreshAccessToken, {
      serverId,
    });
    server = (await ctx.runQuery(
      internal.mcpClient.internals.getServerForCall,
      { serverId }
    )) as ServerForCall | null;
    if (!server) {
      throw new ConvexError("MCP server disappeared after refresh");
    }
  }
  if (!server.encryptedAccessToken || server.tokenKeyVersion === undefined) {
    throw new ConvexError("MCP server has no stored access token");
  }
  const bearer = decryptToken(
    server.encryptedAccessToken,
    server.tokenKeyVersion
  );
  return { server, bearer };
}

/**
 * Hot path: invoked from the chat tool wrapper for every external tool call.
 * Returns the MCP `tools/call` result envelope so the chat handler can hand
 * the content blocks straight back to the model. Errors come back as
 * `{ isError: true, content: [text…] }` so the model can react gracefully.
 */
export const callTool = action({
  args: {
    serverId: v.id("mcpServer"),
    toolName: v.string(),
    args: v.any(),
  },
  handler: async (ctx, args): Promise<McpToolCallResult> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Unauthorized");
    }

    await rateLimiter.limit(ctx, "mcpClientCall", {
      key: args.serverId,
      throws: true,
    });

    const { server, bearer } = await loadActiveBearer(ctx, args.serverId);
    if (server.userId !== (identity.userId as Id<"user">)) {
      throw new ConvexError("MCP server not found");
    }

    if (!server.enabledTools.includes(args.toolName)) {
      return {
        content: [
          {
            type: "text",
            text: `Tool '${args.toolName}' is not enabled on this MCP server. The user can re-enable it in Omi settings.`,
          },
        ],
        isError: true,
      };
    }

    const cleanedArgs = sanitizeToolArgs(
      (args.args ?? {}) as Record<string, unknown>
    );
    dropAntiPatternFilters(cleanedArgs);
    try {
      const result = await callToolWithSessionRetry(
        { url: server.url, bearerToken: bearer },
        args.toolName,
        cleanedArgs
      );
      console.log(
        "[mcp:callTool]",
        args.toolName,
        "raw:",
        args.args,
        "cleaned:",
        cleanedArgs,
        "→",
        {
          isError: result.isError ?? false,
          contentPreview: JSON.stringify(result.content).slice(0, 800),
        }
      );
      return result;
    } catch (err) {
      const message =
        err instanceof McpRpcError
          ? err.message
          : err instanceof Error
            ? err.message
            : "MCP tool call failed";
      if (err instanceof McpRpcError && err.isAuthError) {
        await ctx.runMutation(internal.mcpClient.internals.markServerError, {
          serverId: server._id,
          message,
        });
      }
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  },
});

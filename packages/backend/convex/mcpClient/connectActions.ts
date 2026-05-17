"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { decryptToken, encryptToken } from "../connections/tokens";
import { getAuthIdentity } from "../utils";
import { findCatalogEntry } from "./catalog";
import { McpRpcError, mcpInitialize, mcpToolsList } from "./rpc";

const NAME_MAX_LEN = 80;
const TOOL_PROBE_MAX = 100;

export const connectBearerServer = action({
  args: {
    catalogId: v.optional(v.string()),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Unauthorized");
    }
    const userId = identity.userId as Id<"user">;

    const catalogEntry = args.catalogId
      ? findCatalogEntry(args.catalogId)
      : undefined;
    const url = (args.url ?? catalogEntry?.url ?? "").trim();
    const name = (args.name ?? catalogEntry?.name ?? "").trim();
    const token = args.token.trim();

    if (!url) {
      throw new ConvexError("MCP server URL is required");
    }
    if (!name) {
      throw new ConvexError("Server name is required");
    }
    if (name.length > NAME_MAX_LEN) {
      throw new ConvexError(`Server name must be ≤ ${NAME_MAX_LEN} characters`);
    }
    if (!token) {
      throw new ConvexError("Bearer token is required");
    }

    let tools: Awaited<ReturnType<typeof mcpToolsList>>;
    let instructions: string | undefined;
    try {
      const initResult = await mcpInitialize({ url, bearerToken: token });
      instructions = initResult.instructions?.trim() || undefined;
      tools = await mcpToolsList({
        url,
        bearerToken: token,
        sessionId: initResult.sessionId,
      });
    } catch (err) {
      if (err instanceof McpRpcError) {
        throw new ConvexError(`Could not reach MCP server: ${err.message}`);
      }
      throw new ConvexError("Could not reach MCP server");
    }

    const cachedTools = tools.slice(0, TOOL_PROBE_MAX).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: JSON.stringify(
        t.inputSchema ?? { type: "object", properties: {} }
      ),
    }));
    const enabledTools = cachedTools.map((t) => t.name);

    const encrypted = encryptToken(token);
    const serverId: Id<"mcpServer"> = await ctx.runMutation(
      internal.mcpClient.internals.insertBearerServer,
      {
        userId,
        catalogId: catalogEntry?.catalogId,
        name,
        url,
        encryptedAccessToken: encrypted.ciphertext,
        tokenKeyVersion: encrypted.keyVersion,
        cachedTools,
        enabledTools,
        instructions,
      }
    );

    return {
      serverId,
      tools: cachedTools.map((t) => ({
        name: t.name,
        description: t.description ?? null,
      })),
    };
  },
});

interface RefreshToolsResult {
  added: string[];
  removed: string[];
  total: number;
}

export const refreshTools = action({
  args: { serverId: v.id("mcpServer") },
  handler: async (ctx, args): Promise<RefreshToolsResult> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Unauthorized");
    }
    const server = await ctx.runQuery(
      internal.mcpClient.internals.getServerForCall,
      { serverId: args.serverId }
    );
    if (!server || server.userId !== (identity.userId as Id<"user">)) {
      throw new ConvexError("MCP server not found");
    }

    const bearer = await resolveBearer(ctx, server);

    let tools: Awaited<ReturnType<typeof mcpToolsList>>;
    let instructions: string | undefined;
    try {
      const initResult = await mcpInitialize({
        url: server.url,
        bearerToken: bearer,
      });
      instructions = initResult.instructions?.trim() || undefined;
      tools = await mcpToolsList({
        url: server.url,
        bearerToken: bearer,
        sessionId: initResult.sessionId,
      });
    } catch (err) {
      if (err instanceof McpRpcError) {
        await ctx.runMutation(internal.mcpClient.internals.markServerError, {
          serverId: server._id,
          message: err.message,
        });
        throw new ConvexError(`Refresh failed: ${err.message}`);
      }
      throw new ConvexError("Refresh failed");
    }

    const cachedTools = tools.slice(0, TOOL_PROBE_MAX).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: JSON.stringify(
        t.inputSchema ?? { type: "object", properties: {} }
      ),
    }));
    const cachedNames = new Set(cachedTools.map((t) => t.name));
    const enabledTools = server.enabledTools.filter((name: string) =>
      cachedNames.has(name)
    );
    await ctx.runMutation(internal.mcpClient.internals.patchCachedTools, {
      serverId: server._id,
      cachedTools,
      enabledTools,
      instructions: instructions ?? "",
    });

    const previous = new Set(
      server.cachedTools.map((t: { name: string }) => t.name)
    );
    return {
      added: [...cachedNames].filter((n) => !previous.has(n)),
      removed: [...previous].filter((n) => !cachedNames.has(n)),
      total: cachedTools.length,
    };
  },
});

async function resolveBearer(
  ctx: ActionCtx,
  server: {
    _id: Id<"mcpServer">;
    authType: "bearer" | "oauth2";
    encryptedAccessToken?: string;
    tokenKeyVersion?: number;
    accessTokenExpiresAt?: number;
  }
): Promise<string> {
  if (!server.encryptedAccessToken || server.tokenKeyVersion === undefined) {
    throw new ConvexError("MCP server has no stored access token");
  }
  if (server.authType === "bearer") {
    return decryptToken(server.encryptedAccessToken, server.tokenKeyVersion);
  }
  // OAuth: refresh if within 60s of expiry, then re-read.
  const expiresAt = server.accessTokenExpiresAt;
  if (expiresAt !== undefined && expiresAt - Date.now() < 60_000) {
    await ctx.runAction(internal.mcpClient.oauthActions.refreshAccessToken, {
      serverId: server._id,
    });
    const refreshed = await ctx.runQuery(
      internal.mcpClient.internals.getServerForCall,
      { serverId: server._id }
    );
    if (
      !refreshed?.encryptedAccessToken ||
      refreshed.tokenKeyVersion === undefined
    ) {
      throw new ConvexError("Could not refresh OAuth access token");
    }
    return decryptToken(
      refreshed.encryptedAccessToken,
      refreshed.tokenKeyVersion
    );
  }
  return decryptToken(server.encryptedAccessToken, server.tokenKeyVersion);
}

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const toolDefinitionValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  inputSchema: v.string(),
});

export const insertBearerServer = internalMutation({
  args: {
    userId: v.id("user"),
    catalogId: v.optional(v.string()),
    name: v.string(),
    url: v.string(),
    encryptedAccessToken: v.string(),
    tokenKeyVersion: v.number(),
    cachedTools: v.array(toolDefinitionValidator),
    enabledTools: v.array(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mcpServer", {
      userId: args.userId,
      name: args.name,
      catalogId: args.catalogId,
      url: args.url,
      transport: "streamable_http",
      authType: "bearer",
      encryptedAccessToken: args.encryptedAccessToken,
      tokenKeyVersion: args.tokenKeyVersion,
      status: "active",
      cachedTools: args.cachedTools,
      enabledTools: args.enabledTools,
      toolsLastFetchedAt: now,
      lastConnectedAt: now,
      instructions: args.instructions,
    });
  },
});

export const insertOauthServer = internalMutation({
  args: {
    userId: v.id("user"),
    catalogId: v.optional(v.string()),
    name: v.string(),
    url: v.string(),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    tokenKeyVersion: v.number(),
    accessTokenExpiresAt: v.optional(v.number()),
    oauthClientId: v.optional(v.string()),
    encryptedOauthClientSecret: v.optional(v.string()),
    oauthAuthorizationServer: v.optional(v.string()),
    oauthTokenEndpoint: v.optional(v.string()),
    oauthScope: v.optional(v.string()),
    cachedTools: v.array(toolDefinitionValidator),
    enabledTools: v.array(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mcpServer", {
      userId: args.userId,
      name: args.name,
      catalogId: args.catalogId,
      url: args.url,
      transport: "streamable_http",
      authType: "oauth2",
      encryptedAccessToken: args.encryptedAccessToken,
      encryptedRefreshToken: args.encryptedRefreshToken,
      tokenKeyVersion: args.tokenKeyVersion,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      oauthClientId: args.oauthClientId,
      encryptedOauthClientSecret: args.encryptedOauthClientSecret,
      oauthAuthorizationServer: args.oauthAuthorizationServer,
      oauthTokenEndpoint: args.oauthTokenEndpoint,
      oauthScope: args.oauthScope,
      status: "active",
      cachedTools: args.cachedTools,
      enabledTools: args.enabledTools,
      toolsLastFetchedAt: now,
      lastConnectedAt: now,
      instructions: args.instructions,
    });
  },
});

export const patchCachedTools = internalMutation({
  args: {
    serverId: v.id("mcpServer"),
    cachedTools: v.array(toolDefinitionValidator),
    enabledTools: v.optional(v.array(v.string())),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"mcpServer">> = {
      cachedTools: args.cachedTools,
      toolsLastFetchedAt: Date.now(),
      status: "active",
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
    };
    if (args.enabledTools) {
      patch.enabledTools = args.enabledTools;
    }
    if (args.instructions !== undefined) {
      patch.instructions = args.instructions;
    }
    await ctx.db.patch(args.serverId, patch);
  },
});

export const patchRefreshedTokens = internalMutation({
  args: {
    serverId: v.id("mcpServer"),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    tokenKeyVersion: v.number(),
    accessTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serverId, {
      encryptedAccessToken: args.encryptedAccessToken,
      encryptedRefreshToken: args.encryptedRefreshToken ?? undefined,
      tokenKeyVersion: args.tokenKeyVersion,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      status: "active",
    });
  },
});

export const markServerError = internalMutation({
  args: {
    serverId: v.id("mcpServer"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serverId, {
      status: "error",
      lastErrorAt: Date.now(),
      lastErrorMessage: args.message.slice(0, 500),
    });
  },
});

export const getServerForCall = internalQuery({
  args: { serverId: v.id("mcpServer") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.serverId);
  },
});

export const insertOauthState = internalMutation({
  args: {
    state: v.string(),
    userId: v.id("user"),
    catalogId: v.optional(v.string()),
    name: v.string(),
    url: v.string(),
    pkceVerifier: v.string(),
    oauthClientId: v.optional(v.string()),
    encryptedOauthClientSecret: v.optional(v.string()),
    tokenKeyVersion: v.optional(v.number()),
    authorizationEndpoint: v.string(),
    tokenEndpoint: v.string(),
    authorizationServer: v.optional(v.string()),
    scope: v.optional(v.string()),
    returnTo: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("mcpOauthState", args);
  },
});

export const getOauthState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mcpOauthState")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
  },
});

export const deleteOauthState = internalMutation({
  args: { id: v.id("mcpOauthState") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listEnabledToolsForUser = internalQuery({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const servers = await ctx.db
      .query("mcpServer")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .collect();

    const out: Array<{
      serverId: Id<"mcpServer">;
      serverName: string;
      toolName: string;
      description?: string;
      inputSchema: unknown;
    }> = [];
    for (const server of servers) {
      const enabled = new Set(server.enabledTools);
      for (const tool of server.cachedTools) {
        if (enabled.has(tool.name)) {
          out.push({
            serverId: server._id,
            serverName: server.name,
            toolName: tool.name,
            description: tool.description,
            inputSchema: parseInputSchema(tool.inputSchema),
          });
        }
      }
    }
    return out;
  },
});

function parseInputSchema(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return { type: "object", properties: {} };
  }
}

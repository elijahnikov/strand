import type { Id } from "../_generated/dataModel";
import { protectedQuery } from "../utils";
import { MCP_CATALOG } from "./catalog";

export const listMyMcpServers = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const servers = await ctx.db
      .query("mcpServer")
      .withIndex("by_user_status", (q) => q.eq("userId", ctx.user._id))
      .collect();

    return servers
      .map((s) => ({
        _id: s._id,
        name: s.name,
        catalogId: s.catalogId ?? null,
        url: s.url,
        authType: s.authType,
        status: s.status,
        cachedTools: s.cachedTools.map((t) => ({
          name: t.name,
          description: t.description ?? null,
        })),
        enabledTools: s.enabledTools,
        toolsLastFetchedAt: s.toolsLastFetchedAt,
        lastConnectedAt: s.lastConnectedAt,
        lastErrorAt: s.lastErrorAt ?? null,
        lastErrorMessage: s.lastErrorMessage ?? null,
      }))
      .sort((a, b) => b.lastConnectedAt - a.lastConnectedAt);
  },
});

/**
 * Tools available to the user's chat across every workspace they belong to.
 * MCP servers are user-scoped, not workspace-scoped — connect once, use in
 * any chat the user opens.
 *
 * `inputSchema` is returned as a JSON-encoded string. The chat handler parses
 * it before handing it to the AI SDK. We do not parse server-side because
 * Convex's wire format rejects `$`-prefixed keys (common in JSON Schema).
 */
export const listEnabledToolsForChat = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const servers = await ctx.db
      .query("mcpServer")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", ctx.user._id).eq("status", "active")
      )
      .collect();
    const out: Array<{
      serverId: Id<"mcpServer">;
      serverName: string;
      serverInstructions: string | null;
      toolName: string;
      description: string | null;
      inputSchema: string;
    }> = [];
    for (const server of servers) {
      const enabled = new Set(server.enabledTools);
      for (const tool of server.cachedTools) {
        if (enabled.has(tool.name)) {
          out.push({
            serverId: server._id,
            serverName: server.name,
            serverInstructions: server.instructions ?? null,
            toolName: tool.name,
            description: tool.description ?? null,
            inputSchema: tool.inputSchema,
          });
        }
      }
    }
    return out;
  },
});

export const listCatalog = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const servers = await ctx.db
      .query("mcpServer")
      .withIndex("by_user_status", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const connectedByCatalogId = new Map<string, Id<"mcpServer">>();
    for (const s of servers) {
      if (s.catalogId) {
        connectedByCatalogId.set(s.catalogId, s._id);
      }
    }
    return MCP_CATALOG.map((entry) => ({
      catalogId: entry.catalogId,
      name: entry.name,
      description: entry.description,
      logoKey: entry.logoKey,
      authType: entry.authType,
      helpUrl: entry.helpUrl ?? null,
      connectedServerId: connectedByCatalogId.get(entry.catalogId) ?? null,
    }));
  },
});

import { ConvexError, v } from "convex/values";
import { protectedMutation } from "../utils";

export const setEnabledTools = protectedMutation({
  args: {
    serverId: v.id("mcpServer"),
    toolNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server || server.userId !== ctx.user._id) {
      throw new ConvexError("MCP server not found");
    }
    const cachedNames = new Set(server.cachedTools.map((t) => t.name));
    const filtered = args.toolNames.filter((name) => cachedNames.has(name));
    await ctx.db.patch(args.serverId, { enabledTools: filtered });
  },
});

export const disconnectMcpServer = protectedMutation({
  args: { serverId: v.id("mcpServer") },
  handler: async (ctx, args) => {
    const server = await ctx.db.get(args.serverId);
    if (!server || server.userId !== ctx.user._id) {
      throw new ConvexError("MCP server not found");
    }
    await ctx.db.delete(args.serverId);
  },
});

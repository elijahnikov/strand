import { ConvexError, v } from "convex/values";
import { protectedQuery } from "../utils";

export const listMyConnections = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("connection")
      .withIndex("by_user_provider", (q) => q.eq("userId", ctx.user._id))
      .collect();

    return rows
      .filter((c) => c.status !== "revoked")
      .map((c) => ({
        _id: c._id,
        provider: c.provider,
        authType: c.authType,
        status: c.status,
        providerAccountLabel: c.providerAccountLabel,
        providerAccountId: c.providerAccountId,
        expiresAt: c.expiresAt,
        scope: c.scope,
        lastError: c.lastError,
        lastErrorAt: c.lastErrorAt,
        syncEnabled: c.syncEnabled,
        lastSyncedAt: c.lastSyncedAt,
        createdAt: c.createdAt,
      }));
  },
});

export const getConnection = protectedQuery({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    return {
      _id: connection._id,
      provider: connection.provider,
      authType: connection.authType,
      status: connection.status,
      providerAccountLabel: connection.providerAccountLabel,
      providerAccountId: connection.providerAccountId,
      expiresAt: connection.expiresAt,
      scope: connection.scope,
      lastError: connection.lastError,
      lastErrorAt: connection.lastErrorAt,
      syncEnabled: connection.syncEnabled,
      lastSyncedAt: connection.lastSyncedAt,
      createdAt: connection.createdAt,
    };
  },
});

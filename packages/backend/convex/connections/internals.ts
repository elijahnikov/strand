import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const providerValidator = v.union(
  v.literal("notion"),
  v.literal("raindrop"),
  v.literal("google_drive"),
  v.literal("readwise")
);

const authTypeValidator = v.union(v.literal("oauth2"), v.literal("api_token"));

export const insertConnection = internalMutation({
  args: {
    userId: v.id("user"),
    provider: providerValidator,
    authType: authTypeValidator,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    providerAccountLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("connection")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider)
      )
      .collect();

    const sameAccount = args.providerAccountId
      ? existing.find((c) => c.providerAccountId === args.providerAccountId)
      : existing.find((c) => c.status === "active" || c.status === "expired");

    const now = Date.now();

    if (sameAccount) {
      await ctx.db.patch(sameAccount._id, {
        authType: args.authType,
        status: "active",
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        providerAccountId: args.providerAccountId,
        providerAccountLabel: args.providerAccountLabel,
        lastError: undefined,
        lastErrorAt: undefined,
        disconnectedAt: undefined,
      });
      return sameAccount._id;
    }

    return await ctx.db.insert("connection", {
      userId: args.userId,
      provider: args.provider,
      authType: args.authType,
      status: "active",
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      providerAccountId: args.providerAccountId,
      providerAccountLabel: args.providerAccountLabel,
      createdAt: now,
    });
  },
});

export const updateTokenAfterRefresh = internalMutation({
  args: {
    connectionId: v.id("connection"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      throw new ConvexError("Connection not found");
    }
    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken ?? connection.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope ?? connection.scope,
      status: "active",
      lastError: undefined,
      lastErrorAt: undefined,
    });
  },
});

export const markError = internalMutation({
  args: {
    connectionId: v.id("connection"),
    error: v.string(),
    status: v.union(
      v.literal("expired"),
      v.literal("error"),
      v.literal("revoked")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      status: args.status,
      lastError: args.error,
      lastErrorAt: Date.now(),
    });
  },
});

export const getActiveToken = internalQuery({
  args: {
    connectionId: v.id("connection"),
    userId: v.id("user"),
    requiredProvider: providerValidator,
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== args.userId) {
      throw new ConvexError("Connection not found");
    }
    if (connection.provider !== args.requiredProvider) {
      throw new ConvexError(
        `Connection is for ${connection.provider}, expected ${args.requiredProvider}`
      );
    }
    if (connection.status !== "active") {
      throw new ConvexError(`Connection is ${connection.status}`);
    }
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
      providerAccountId: connection.providerAccountId,
    };
  },
});

export const getConnectionForRefresh = internalQuery({
  args: { connectionId: v.id("connection") },
  handler: async (
    ctx,
    args
  ): Promise<{
    _id: Id<"connection">;
    provider: "notion" | "raindrop" | "google_drive" | "readwise";
    refreshToken: string | undefined;
  } | null> => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      return null;
    }
    return {
      _id: connection._id,
      provider: connection.provider,
      refreshToken: connection.refreshToken,
    };
  },
});

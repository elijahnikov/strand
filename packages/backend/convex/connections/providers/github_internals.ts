import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

interface ScopedRepo {
  hookId?: number;
  name: string;
}

interface GitHubScopeSelection {
  repos?: ScopedRepo[];
  starsEnabled?: boolean;
  starsSnapshot?: string[];
}

export const getConnectionForGithub = internalQuery({
  args: { connectionId: v.id("connection") },
  handler: async (
    ctx,
    args
  ): Promise<{
    encryptedAccessToken: string;
    tokenKeyVersion: number;
    webhookSecret: string | undefined;
    scopeSelection: GitHubScopeSelection;
  } | null> => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn || conn.provider !== "github") {
      return null;
    }
    if (!(conn.encryptedAccessToken && conn.tokenKeyVersion)) {
      return null;
    }
    return {
      encryptedAccessToken: conn.encryptedAccessToken,
      tokenKeyVersion: conn.tokenKeyVersion,
      webhookSecret: conn.webhookSecret,
      scopeSelection: (conn.scopeSelection as GitHubScopeSelection) ?? {},
    };
  },
});

export const writeScopeSelection = internalMutation({
  args: {
    connectionId: v.id("connection"),
    scopeSelection: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      scopeSelection: args.scopeSelection,
    });
  },
});

export const finalizeDisconnect = internalMutation({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      status: "revoked",
      accessToken: undefined,
      refreshToken: undefined,
      encryptedAccessToken: undefined,
      encryptedRefreshToken: undefined,
      tokenKeyVersion: undefined,
      syncEnabled: false,
      webhookSecret: undefined,
    });
  },
});

export const listActiveGithubConnections = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"connection">[]> => {
    const all = await ctx.db
      .query("connection")
      .withIndex("by_status_syncEnabled", (q) =>
        q.eq("status", "active").eq("syncEnabled", true)
      )
      .collect();
    return all
      .filter((c: Doc<"connection">) => c.provider === "github")
      .map((c) => c._id);
  },
});

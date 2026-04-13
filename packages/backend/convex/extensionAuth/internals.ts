import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { hashExtensionToken } from "./shared";

export const getMembership = internalQuery({
  args: {
    userId: v.id("user"),
    workspaceId: v.id("workspace"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.deletedAt) {
      return null;
    }
    if (workspace.ownerId === args.userId) {
      return { role: "owner" as const };
    }
    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();
    return member ? { role: member.role } : null;
  },
});

export const listWorkspacesForUser = internalQuery({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user_last_accessed", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const rows = await Promise.all(
      members.map(async (m) => {
        const ws = await ctx.db.get(m.workspaceId);
        if (!ws || ws.deletedAt) {
          return null;
        }
        return {
          id: ws._id,
          name: ws.name,
          role: m.role,
          icon: ws.icon ?? null,
          emoji: ws.emoji ?? null,
        };
      })
    );
    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const resolveByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashExtensionToken(args.token);
    const row = await ctx.db
      .query("extensionToken")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (!row) {
      return null;
    }
    if (row.revokedAt || row.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(row.userId);
    if (!user) {
      return null;
    }

    return {
      tokenId: row._id,
      userId: row.userId,
      defaultWorkspaceId: row.defaultWorkspaceId,
    };
  },
});

export const touchLastUsed = internalMutation({
  args: { tokenId: v.id("extensionToken") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tokenId);
    if (!row) {
      return;
    }
    await ctx.db.patch(args.tokenId, { lastUsedAt: Date.now() });
  },
});

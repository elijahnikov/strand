import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthIdentity } from "../utils";

export const getWorkspaceProvider = query({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const userId = identity.userId as Id<"user">;
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }
    const isOwner = workspace.ownerId === userId;
    const member = isOwner
      ? { role: "owner" as const }
      : await ctx.db
          .query("workspaceMember")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("userId", userId)
          )
          .unique();
    if (!member) {
      throw new ConvexError("Not authorized");
    }
    const row = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    return {
      isAdmin: member.role === "owner" || member.role === "admin",
      provider: row?.provider ?? null,
      model: row?.model ?? null,
      lastValidatedAt: row?.lastValidatedAt ?? null,
      hasKey: !!row,
    };
  },
});

/**
 * Internal: returns the raw encrypted row for a workspace. Node-side actions
 * call this then decrypt the key locally. Never expose to clients.
 */
export const getProviderRowInternal = internalQuery({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!row) {
      return null;
    }
    return {
      provider: row.provider,
      encryptedApiKey: row.encryptedApiKey,
      model: row.model ?? null,
    };
  },
});

export const upsertKeyInternal = internalMutation({
  args: {
    workspaceId: v.id("workspace"),
    provider: v.union(
      v.literal("openai"),
      v.literal("google"),
      v.literal("anthropic")
    ),
    encryptedApiKey: v.string(),
    model: v.optional(v.string()),
    createdByUserId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        encryptedApiKey: args.encryptedApiKey,
        model: args.model,
        lastValidatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("workspaceAIProvider", {
      workspaceId: args.workspaceId,
      provider: args.provider,
      encryptedApiKey: args.encryptedApiKey,
      model: args.model,
      createdByUserId: args.createdByUserId,
      lastValidatedAt: now,
    });
  },
});

/**
 * Admin-only. Removes the BYO key; the workspace falls back to the platform
 * default and resumes credit-metered billing on the next chat turn.
 */
export const removeWorkspaceKey = mutation({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const userId = identity.userId as Id<"user">;
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }
    const isOwner = workspace.ownerId === userId;
    if (!isOwner) {
      const member = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", userId)
        )
        .unique();
      if (!member || member.role !== "admin") {
        throw new ConvexError(
          "Only workspace admins can manage the AI provider"
        );
      }
    }
    const existing = await ctx.db
      .query("workspaceAIProvider")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true as const };
  },
});

import { ConvexError, v } from "convex/values";
import {
  DEFAULT_TOKEN_TTL_MS,
  generateExtensionToken,
  hashExtensionToken,
} from "../extensionAuth/shared";
import { protectedMutation, protectedQuery } from "../utils";

const MAX_ACTIVE_MCP_TOKENS_PER_USER = 10;
const MCP_TOKEN_PREFIX_REPLACEMENT = "omi_mcp_";
const EXTENSION_PREFIX_RE = /^[^_]+_[^_]+_/;

export const mintMcpToken = protectedMutation({
  args: {
    workspaceId: v.id("workspace"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedLabel = args.label.trim();
    if (trimmedLabel.length === 0 || trimmedLabel.length > 80) {
      throw new ConvexError("Label must be 1–80 characters");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.deletedAt) {
      throw new ConvexError("Workspace not found");
    }
    if (workspace.ownerId !== ctx.user._id) {
      const member = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", ctx.user._id)
        )
        .unique();
      if (!member) {
        throw new ConvexError("Not a member of this workspace");
      }
    }

    const existing = await ctx.db
      .query("extensionToken")
      .withIndex("by_user", (q) =>
        q.eq("userId", ctx.user._id).eq("revokedAt", undefined)
      )
      .collect();

    const activeMcp = existing.filter((t) => t.kind === "mcp");
    if (activeMcp.length >= MAX_ACTIVE_MCP_TOKENS_PER_USER) {
      throw new ConvexError(
        `You already have ${MAX_ACTIVE_MCP_TOKENS_PER_USER} active MCP tokens. Revoke one to create another.`
      );
    }

    // Reuse the shared generator; rewrite the prefix so MCP tokens are
    // visually distinct from extension tokens at a glance.
    const rawToken = generateExtensionToken();
    const plaintext = rawToken.replace(
      EXTENSION_PREFIX_RE,
      MCP_TOKEN_PREFIX_REPLACEMENT
    );
    const tokenHash = await hashExtensionToken(plaintext);
    const now = Date.now();

    await ctx.db.insert("extensionToken", {
      userId: ctx.user._id,
      defaultWorkspaceId: args.workspaceId,
      tokenHash,
      label: trimmedLabel,
      createdAt: now,
      expiresAt: now + DEFAULT_TOKEN_TTL_MS,
      kind: "mcp",
    });

    return {
      token: plaintext,
      userId: ctx.user._id,
      workspaceId: args.workspaceId,
      expiresAt: now + DEFAULT_TOKEN_TTL_MS,
    };
  },
});

export const listMyMcpTokens = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("extensionToken")
      .withIndex("by_user", (q) =>
        q.eq("userId", ctx.user._id).eq("revokedAt", undefined)
      )
      .collect();

    const mcpRows = rows.filter((row) => row.kind === "mcp");

    const enriched = await Promise.all(
      mcpRows.map(async (row) => {
        const workspace = row.defaultWorkspaceId
          ? await ctx.db.get(row.defaultWorkspaceId)
          : null;
        return {
          _id: row._id,
          label: row.label,
          workspaceId: row.defaultWorkspaceId ?? null,
          workspaceName: workspace?.name ?? null,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          lastUsedAt: row.lastUsedAt,
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const revokeMcpToken = protectedMutation({
  args: {
    tokenId: v.id("extensionToken"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.userId !== ctx.user._id || row.kind !== "mcp") {
      throw new ConvexError("Token not found");
    }
    if (row.revokedAt) {
      return;
    }
    await ctx.db.patch(args.tokenId, { revokedAt: Date.now() });
  },
});

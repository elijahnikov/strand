import { ConvexError, v } from "convex/values";
import { protectedMutation } from "../utils";
import {
  DEFAULT_TOKEN_TTL_MS,
  generateExtensionToken,
  hashExtensionToken,
} from "./shared";

const MAX_ACTIVE_TOKENS_PER_USER = 10;

export const mintExtensionToken = protectedMutation({
  args: {
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedLabel = args.label.trim();
    if (trimmedLabel.length === 0 || trimmedLabel.length > 80) {
      throw new ConvexError("Label must be 1–80 characters");
    }

    const existing = await ctx.db
      .query("extensionToken")
      .withIndex("by_user", (q) =>
        q.eq("userId", ctx.user._id).eq("revokedAt", undefined)
      )
      .collect();

    if (existing.length >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new ConvexError(
        `You already have ${MAX_ACTIVE_TOKENS_PER_USER} active extension tokens. Revoke one to create another.`
      );
    }

    const mostRecentMember = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user_last_accessed", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .first();

    const plaintext = generateExtensionToken();
    const tokenHash = await hashExtensionToken(plaintext);
    const now = Date.now();

    await ctx.db.insert("extensionToken", {
      userId: ctx.user._id,
      defaultWorkspaceId: mostRecentMember?.workspaceId,
      tokenHash,
      label: trimmedLabel,
      createdAt: now,
      expiresAt: now + DEFAULT_TOKEN_TTL_MS,
    });

    return {
      token: plaintext,
      userId: ctx.user._id,
      defaultWorkspaceId: mostRecentMember?.workspaceId ?? null,
      expiresAt: now + DEFAULT_TOKEN_TTL_MS,
    };
  },
});

export const revokeExtensionToken = protectedMutation({
  args: {
    tokenId: v.id("extensionToken"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.userId !== ctx.user._id) {
      throw new ConvexError("Token not found");
    }
    if (row.revokedAt) {
      return;
    }
    await ctx.db.patch(args.tokenId, { revokedAt: Date.now() });
  },
});

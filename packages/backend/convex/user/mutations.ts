import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { protectedMutation } from "../utils";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const updateProfile = protectedMutation({
  args: {
    username: v.optional(v.string()),
    image: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"user">> = {};

    if (args.username !== undefined) {
      const trimmed = args.username.trim();
      if (trimmed.length < 2 || trimmed.length > 32) {
        throw new ConvexError("Username must be 2-32 characters");
      }
      if (!USERNAME_PATTERN.test(trimmed)) {
        throw new ConvexError(
          "Username may only contain letters, numbers, dashes, and underscores"
        );
      }
      patch.username = trimmed;
    }

    if (args.image !== undefined) {
      patch.image = args.image ?? undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(ctx.user._id, patch);
    }
  },
});

export const generateAvatarUploadUrl = protectedMutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});

export const setAvatarFromStorage = protectedMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new ConvexError("Uploaded avatar could not be resolved");
    }
    await ctx.db.patch(ctx.user._id, { image: url });
    return url;
  },
});

export const deleteAccount = protectedMutation({
  args: {},
  handler: async (ctx) => {
    const userId: Id<"user"> = ctx.user._id;
    await cascadeDeleteUserData(ctx, userId);
    await ctx.db.delete(userId);
  },
});

async function cascadeDeleteUserData(ctx: MutationCtx, userId: Id<"user">) {
  const now = Date.now();

  const tokens = await ctx.db
    .query("extensionToken")
    .withIndex("by_user", (q) =>
      q.eq("userId", userId).eq("revokedAt", undefined)
    )
    .collect();
  for (const token of tokens) {
    await ctx.db.patch(token._id, { revokedAt: now });
  }

  const connections = await ctx.db
    .query("connection")
    .withIndex("by_user_provider", (q) => q.eq("userId", userId))
    .collect();
  for (const connection of connections) {
    if (connection.status !== "revoked") {
      await ctx.db.patch(connection._id, {
        status: "revoked",
        disconnectedAt: now,
      });
    }
  }

  const memberships = await ctx.db
    .query("workspaceMember")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const member of memberships) {
    const workspace = await ctx.db.get(member.workspaceId);
    if (workspace && workspace.ownerId === userId && !workspace.deletedAt) {
      await ctx.db.patch(workspace._id, { deletedAt: now });
    }
    await ctx.db.delete(member._id);
  }
}

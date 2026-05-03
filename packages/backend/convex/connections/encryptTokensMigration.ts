import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Query/mutation half of the encryptTokens migration. The action runner lives in
 * encryptTokensMigrationAction.ts (Node runtime) since encryption uses node:crypto.
 */

export const listPlaintextRows = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("connection")
      .paginate({ cursor: args.cursor ?? null, numItems: 50 });
    const rows = result.page.map((c) => ({
      _id: c._id,
      accessToken: c.accessToken,
      refreshToken: c.refreshToken,
      hasEncrypted: Boolean(c.encryptedAccessToken),
    }));
    return {
      rows,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const writeEncryptedTokens = internalMutation({
  args: {
    connectionId: v.id("connection"),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    tokenKeyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      encryptedAccessToken: args.encryptedAccessToken,
      encryptedRefreshToken: args.encryptedRefreshToken,
      tokenKeyVersion: args.tokenKeyVersion,
      accessToken: undefined,
      refreshToken: undefined,
    });
  },
});

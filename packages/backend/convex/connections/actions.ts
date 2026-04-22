"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { rateLimiter } from "../rateLimiter";
import { getAuthIdentity } from "../utils";
import { getApiTokenProvider } from "./providers/registry";

export const connectReadwise = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Id<"connection">> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    await rateLimiter.limit(ctx, "oauthAuthorize", {
      key: identity.userId,
      throws: true,
    });
    const token = args.token.trim();
    if (token.length === 0) {
      throw new ConvexError("Token is required");
    }

    const descriptor = getApiTokenProvider("readwise");
    const accountInfo = await descriptor.validateToken(token).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConvexError(message);
    });

    return await ctx.runMutation(
      internal.connections.internals.insertConnection,
      {
        userId: identity.userId as Id<"user">,
        provider: "readwise",
        authType: "api_token",
        accessToken: token,
        providerAccountId: accountInfo.providerAccountId,
        providerAccountLabel: accountInfo.providerAccountLabel,
      }
    );
  },
});

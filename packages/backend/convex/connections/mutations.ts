import { ConvexError, v } from "convex/values";
import { protectedMutation } from "../utils";

export const disconnect = protectedMutation({
  args: { connectionId: v.id("connection") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    if (connection.status === "revoked") {
      return;
    }
    await ctx.db.patch(args.connectionId, {
      status: "revoked",
      accessToken: "",
      refreshToken: undefined,
      syncEnabled: false,
      disconnectedAt: Date.now(),
    });
  },
});

export const rename = protectedMutation({
  args: {
    connectionId: v.id("connection"),
    providerAccountLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.userId !== ctx.user._id) {
      throw new ConvexError("Connection not found");
    }
    const trimmed = args.providerAccountLabel.trim();
    if (trimmed.length === 0 || trimmed.length > 120) {
      throw new ConvexError("Label must be 1–120 characters");
    }
    await ctx.db.patch(args.connectionId, {
      providerAccountLabel: trimmed,
    });
  },
});

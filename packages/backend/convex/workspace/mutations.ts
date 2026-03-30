import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const seedWorkspace = internalMutation({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const workspaceId = await ctx.db.insert("workspace", {
      name: `${user.username}'s Workspace`,
      ownerId: args.userId,
    });

    await ctx.db.insert("workspaceMember", {
      workspaceId,
      userId: args.userId,
      role: "owner",
      lastAccessedAt: Date.now(),
    });

    return workspaceId;
  },
});

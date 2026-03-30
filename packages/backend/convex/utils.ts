import { ConvexError, v } from "convex/values";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const protectedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const user = await ctx.db.get(authUser.userId as Id<"user">);
    console.log({ user, authUser });
    if (!user) {
      throw new ConvexError("User not found");
    }
    return { user, authUser };
  })
);

export const protectedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const user = await ctx.db.get(authUser.userId as Id<"user">);

    if (!user) {
      throw new ConvexError("User not found");
    }
    return { user, authUser };
  })
);

type WorkspaceRole = "owner" | "admin" | "member";
export const workspaceQuery = customQuery(query, {
  args: { workspaceId: v.id("workspace") },
  input: async (ctx, args, { role }: { role?: WorkspaceRole[] }) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const user = await ctx.db.get(authUser.userId as Id<"user">);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .unique();

    if (workspace.ownerId === user._id) {
      return { ctx: { user, authUser, workspace, member }, args: {} };
    }

    if (!member || (role && !role.includes(member.role))) {
      throw new ConvexError("Not authorized to access this workspace");
    }

    return { ctx: { user, authUser, workspace, member }, args: {} };
  },
});

export const workspaceMutation = customMutation(mutation, {
  args: { workspaceId: v.id("workspace") },
  input: async (ctx, args, { role }: { role?: WorkspaceRole[] }) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const user = await ctx.db.get(authUser.userId as Id<"user">);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .unique();

    if (workspace.ownerId === user._id) {
      return { ctx: { user, authUser, workspace, member }, args: {} };
    }

    if (!member || (role && !role.includes(member.role))) {
      throw new ConvexError("Not authorized to access this workspace");
    }

    return { ctx: { user, authUser, workspace, member }, args: {} };
  },
});

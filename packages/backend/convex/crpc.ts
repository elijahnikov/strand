import { CRPCError, initCRPC, zid } from "kitcn/server";
import { z } from "zod";
import type { DataModel, Id } from "./_generated/dataModel";
import { getAuthIdentity } from "./utils";

export const c = initCRPC.dataModel<DataModel>().create();

export const publicQuery = c.query;
export const publicMutation = c.mutation;
export const publicAction = c.action;

export const protectedQuery = c.query.use(async ({ ctx, next }) => {
  const identity = await getAuthIdentity(ctx);
  if (!identity?.userId) {
    throw new CRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const user = await ctx.db.get(identity.userId as Id<"user">);
  if (!user) {
    throw new CRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }
  return next({ ctx: { ...ctx, user, identity } });
});

export const protectedMutation = c.mutation.use(async ({ ctx, next }) => {
  const identity = await getAuthIdentity(ctx);
  if (!identity?.userId) {
    throw new CRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const user = await ctx.db.get(identity.userId as Id<"user">);
  if (!user) {
    throw new CRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }
  return next({ ctx: { ...ctx, user, identity } });
});

type WorkspaceRole = "owner" | "admin" | "member";

export const workspaceQuery = (opts?: { role?: WorkspaceRole[] }) =>
  protectedQuery
    .input(z.object({ workspaceId: zid("workspace") }))
    .use(async ({ ctx, input, next }) => {
      const workspace = await ctx.db.get(input.workspaceId);
      if (!workspace) {
        throw new CRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const member = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", input.workspaceId).eq("userId", ctx.user._id)
        )
        .unique();

      if (workspace.ownerId === ctx.user._id) {
        return next({ ctx: { ...ctx, workspace, member } });
      }

      if (!member || (opts?.role && !opts.role.includes(member.role))) {
        throw new CRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to access this workspace",
        });
      }

      return next({ ctx: { ...ctx, workspace, member } });
    });

export const workspaceMutation = (opts?: { role?: WorkspaceRole[] }) =>
  protectedMutation
    .input(z.object({ workspaceId: zid("workspace") }))
    .use(async ({ ctx, input, next }) => {
      const workspace = await ctx.db.get(input.workspaceId);
      if (!workspace) {
        throw new CRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const member = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", input.workspaceId).eq("userId", ctx.user._id)
        )
        .unique();

      if (workspace.ownerId === ctx.user._id) {
        return next({ ctx: { ...ctx, workspace, member } });
      }

      if (!member || (opts?.role && !opts.role.includes(member.role))) {
        throw new CRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to access this workspace",
        });
      }

      return next({ ctx: { ...ctx, workspace, member } });
    });

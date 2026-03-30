import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { protectedQuery, workspaceQuery } from "../utils";

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser?.userId) {
      return null;
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user", (q) =>
        q.eq("userId", authUser.userId as Id<"user">)
      )
      .first();

    if (!member) {
      return null;
    }

    return ctx.db.get(member.workspaceId);
  },
});

export const listByUser = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user_last_accessed", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .collect();

    const workspaces = await Promise.all(
      members.map(async (member) => {
        const workspace = await ctx.db.get(member.workspaceId);
        return workspace ? { ...workspace, role: member.role } : null;
      })
    );

    return workspaces.filter((w) => w !== null);
  },
});

export const getById = workspaceQuery({
  args: {},
  handler: (ctx) => {
    return {
      workspace: ctx.workspace,
      member: ctx.member,
    };
  },
});

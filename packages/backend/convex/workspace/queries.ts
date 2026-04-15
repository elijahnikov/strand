import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getAuthIdentity, protectedQuery, workspaceQuery } from "../utils";

// ── Workspace ────────────────────────────────────────────────────────

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      return null;
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user", (q) =>
        q.eq("userId", identity.userId as Id<"user">)
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

// ── Invitations ──────────────────────────────────────────────────────

export const listInvitationsByWorkspace = workspaceQuery({
  args: {},
  role: ["owner", "admin"],
  handler: async (ctx) => {
    const invitations = await ctx.db
      .query("workspaceInvitation")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("status", "pending")
      )
      .collect();

    const enriched = await Promise.all(
      invitations.map(async (invitation) => {
        const inviter = await ctx.db.get(invitation.invitedByUserId);
        return {
          ...invitation,
          inviterName: inviter?.username ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const listPendingInvitationsForUser = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const invitations = await ctx.db
      .query("workspaceInvitation")
      .withIndex("by_invited_email", (q) =>
        q.eq("invitedEmail", ctx.user.email).eq("status", "pending")
      )
      .collect();

    const enriched = await Promise.all(
      invitations.map(async (invitation) => {
        const workspace = await ctx.db.get(invitation.workspaceId);
        const inviter = await ctx.db.get(invitation.invitedByUserId);
        return {
          ...invitation,
          workspaceName: workspace?.name ?? "Unknown workspace",
          workspaceEmoji: workspace?.emoji,
          workspaceIcon: workspace?.icon,
          inviterName: inviter?.username ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

// ── Members ──────────────────────────────────────────────────────────

export const listMembers = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();

    const enriched = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          username: user?.username ?? "Unknown",
          email: user?.email ?? "",
          image: user?.image,
        };
      })
    );

    const roleOrder = { owner: 0, admin: 1, member: 2 } as const;
    return enriched.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  },
});

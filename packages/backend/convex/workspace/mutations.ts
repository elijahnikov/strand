import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { tierToWorkspaceLimit } from "../billing/pricing";
import { resolveActingBillingAccount } from "../billing/resolver";
import { protectedMutation, workspaceMutation } from "../utils";

// ── Workspace ────────────────────────────────────────────────────────

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

export const create = protectedMutation({
  args: {
    name: v.string(),
    emoji: v.optional(v.string()),
    icon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new ConvexError("Workspace name cannot be empty");
    }
    if (trimmed.length > 60) {
      throw new ConvexError("Workspace name must be 60 characters or fewer");
    }

    const memberships = await ctx.db
      .query("workspaceMember")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const { plan } = await resolveActingBillingAccount(ctx, ctx.user._id);
    const limit = tierToWorkspaceLimit(plan);
    if (memberships.length >= limit) {
      throw new ConvexError(
        plan === "free"
          ? `Free plan is limited to ${limit} workspaces. Upgrade to Basic for unlimited.`
          : `You can belong to at most ${limit} workspaces`
      );
    }

    const workspaceId = await ctx.db.insert("workspace", {
      name: trimmed,
      ownerId: ctx.user._id,
      emoji: args.emoji,
      icon: args.icon,
      iconColor: args.iconColor,
    });
    await ctx.db.insert("workspaceMember", {
      workspaceId,
      userId: ctx.user._id,
      role: "owner",
      lastAccessedAt: Date.now(),
    });
    return workspaceId;
  },
});

export const update = workspaceMutation({
  args: {
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  role: ["owner", "admin"],
  handler: async (ctx, args) => {
    const patch: Record<string, string | undefined> = {};

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        throw new ConvexError("Workspace name cannot be empty");
      }
      patch.name = trimmed;
    }

    if (args.emoji !== undefined) {
      patch.emoji = args.emoji;
      patch.icon = undefined;
      patch.iconColor = undefined;
    } else if (args.icon !== undefined) {
      patch.icon = args.icon;
      patch.iconColor = args.iconColor;
      patch.emoji = undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(ctx.workspace._id, patch);
    }
  },
});

export const deleteWorkspace = workspaceMutation({
  args: {},
  role: ["owner"],
  handler: async (ctx) => {
    await ctx.db.patch(ctx.workspace._id, { deletedAt: Date.now() });
  },
});

// ── Invitations ──────────────────────────────────────────────────────

export const createInvitation = workspaceMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  role: ["owner", "admin"],
  handler: async (ctx, args) => {
    if (args.email === ctx.user.email) {
      throw new ConvexError("You cannot invite yourself");
    }

    const existingUser = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      const existingMember = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("userId", existingUser._id)
        )
        .unique();

      if (existingMember) {
        throw new ConvexError(
          "This user is already a member of this workspace"
        );
      }
    }

    const existingInvite = await ctx.db
      .query("workspaceInvitation")
      .withIndex("by_workspace_email", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("invitedEmail", args.email)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .unique();

    if (existingInvite) {
      throw new ConvexError("An invitation is already pending for this email");
    }

    return ctx.db.insert("workspaceInvitation", {
      workspaceId: ctx.workspace._id,
      invitedEmail: args.email,
      invitedUserId: existingUser?._id,
      invitedByUserId: ctx.user._id,
      role: args.role,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const revokeInvitation = workspaceMutation({
  args: {
    invitationId: v.id("workspaceInvitation"),
  },
  role: ["owner", "admin"],
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new ConvexError("Invitation is no longer pending");
    }

    await ctx.db.patch(args.invitationId, {
      status: "revoked",
      respondedAt: Date.now(),
    });
  },
});

export const acceptInvitation = protectedMutation({
  args: {
    invitationId: v.id("workspaceInvitation"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new ConvexError("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new ConvexError("Invitation is no longer pending");
    }

    if (invitation.invitedEmail !== ctx.user.email) {
      throw new ConvexError("This invitation is not for you");
    }

    const existingMember = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invitation.workspaceId).eq("userId", ctx.user._id)
      )
      .unique();

    if (existingMember) {
      throw new ConvexError("You are already a member of this workspace");
    }

    await ctx.db.insert("workspaceMember", {
      workspaceId: invitation.workspaceId,
      userId: ctx.user._id,
      role: invitation.role,
      lastAccessedAt: Date.now(),
    });

    await ctx.db.patch(args.invitationId, {
      status: "accepted",
      respondedAt: Date.now(),
      invitedUserId: ctx.user._id,
    });
  },
});

export const declineInvitation = protectedMutation({
  args: {
    invitationId: v.id("workspaceInvitation"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new ConvexError("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new ConvexError("Invitation is no longer pending");
    }

    if (invitation.invitedEmail !== ctx.user.email) {
      throw new ConvexError("This invitation is not for you");
    }

    await ctx.db.patch(args.invitationId, {
      status: "declined",
      respondedAt: Date.now(),
    });
  },
});

// ── Members ──────────────────────────────────────────────────────────

export const updateRole = workspaceMutation({
  args: {
    memberId: v.id("workspaceMember"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  role: ["owner"],
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId);
    if (!target || target.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Member not found");
    }

    if (target.role === "owner") {
      throw new ConvexError("Cannot change the owner's role");
    }

    await ctx.db.patch(args.memberId, { role: args.role });
  },
});

export const removeMember = workspaceMutation({
  args: {
    memberId: v.id("workspaceMember"),
  },
  role: ["owner", "admin"],
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId);
    if (!target || target.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Member not found");
    }

    if (target.role === "owner") {
      throw new ConvexError("Cannot remove the workspace owner");
    }

    if (ctx.member?.role === "admin" && target.role === "admin") {
      throw new ConvexError("Admins cannot remove other admins");
    }

    await ctx.db.delete(args.memberId);
  },
});

export const leaveWorkspace = protectedMutation({
  args: {
    workspaceId: v.id("workspace"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.ownerId === ctx.user._id) {
      throw new ConvexError(
        "The workspace owner cannot leave. Transfer ownership first."
      );
    }

    const member = await ctx.db
      .query("workspaceMember")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", ctx.user._id)
      )
      .unique();

    if (!member) {
      throw new ConvexError("You are not a member of this workspace");
    }

    await ctx.db.delete(member._id);
  },
});

import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { type RateLimitName, rateLimiter } from "./rateLimiter";

export type AuthIdentity = UserIdentity & {
  userId?: string;
  sessionId?: string;
};

export const getAuthIdentity = (ctx: {
  auth: { getUserIdentity(): Promise<UserIdentity | null> };
}) => ctx.auth.getUserIdentity() as Promise<AuthIdentity | null>;

interface ProtectedOpts {
  rateLimit?: RateLimitName;
}

type WorkspaceRole = "owner" | "admin" | "member";
interface WorkspaceOpts extends ProtectedOpts {
  role?: WorkspaceRole[];
}

export const protectedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const user = await ctx.db.get(identity.userId as Id<"user">);
    if (!user) {
      throw new ConvexError("User not found");
    }
    return { user, identity };
  })
);

export const protectedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, _args, opts: ProtectedOpts = {}) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const user = await ctx.db.get(identity.userId as Id<"user">);
    if (!user) {
      throw new ConvexError("User not found");
    }
    if (opts.rateLimit) {
      await rateLimiter.limit(ctx, opts.rateLimit, {
        key: user._id,
        throws: true,
      });
    }
    return { ctx: { user, identity }, args: {} };
  },
});

export const protectedAction = customAction(action, {
  args: {},
  input: async (ctx, _args, opts: ProtectedOpts = {}) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    if (opts.rateLimit) {
      await rateLimiter.limit(ctx, opts.rateLimit, {
        key: identity.userId,
        throws: true,
      });
    }
    return {
      ctx: { identity, userId: identity.userId as Id<"user"> },
      args: {},
    };
  },
});

export const workspaceQuery = customQuery(query, {
  args: { workspaceId: v.id("workspace") },
  input: async (ctx, args, { role }: { role?: WorkspaceRole[] } = {}) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const user = await ctx.db.get(identity.userId as Id<"user">);
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
      return { ctx: { user, identity, workspace, member }, args: {} };
    }

    if (!member || (role && !role.includes(member.role))) {
      throw new ConvexError("Not authorized to access this workspace");
    }

    return { ctx: { user, identity, workspace, member }, args: {} };
  },
});

export const workspaceMutation = customMutation(mutation, {
  args: { workspaceId: v.id("workspace") },
  input: async (ctx, args, opts: WorkspaceOpts = {}) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const user = await ctx.db.get(identity.userId as Id<"user">);
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

    const isOwner = workspace.ownerId === user._id;
    if (
      !isOwner &&
      (!member || (opts.role && !opts.role.includes(member.role)))
    ) {
      throw new ConvexError("Not authorized to access this workspace");
    }

    if (opts.rateLimit) {
      await rateLimiter.limit(ctx, opts.rateLimit, {
        key: user._id,
        throws: true,
      });
    }

    return { ctx: { user, identity, workspace, member }, args: {} };
  },
});

export const workspaceAction = customAction(action, {
  args: { workspaceId: v.id("workspace") },
  input: async (ctx, _args, opts: WorkspaceOpts = {}) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    if (opts.rateLimit) {
      await rateLimiter.limit(ctx, opts.rateLimit, {
        key: identity.userId,
        throws: true,
      });
    }
    return {
      ctx: { identity, userId: identity.userId as Id<"user"> },
      args: {},
    };
  },
});

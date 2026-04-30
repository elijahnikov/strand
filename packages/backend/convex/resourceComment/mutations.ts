import { ConvexError, v } from "convex/values";
import { workspaceMutation } from "../utils";

export const create = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
    content: v.string(),
    mentions: v.optional(v.array(v.id("user"))),
  },
  handler: async (ctx, args) => {
    const trimmed = args.content.trim();
    if (!trimmed) {
      throw new ConvexError("Comment cannot be empty");
    }

    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("resourceComment", {
      workspaceId: ctx.workspace._id,
      resourceId: args.resourceId,
      authorId: ctx.user._id,
      content: trimmed,
      mentions: args.mentions,
      createdAt: now,
    });

    const existing = await ctx.db
      .query("resourceCommentRead")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", ctx.user._id).eq("resourceId", args.resourceId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("resourceCommentRead", {
        userId: ctx.user._id,
        resourceId: args.resourceId,
        workspaceId: ctx.workspace._id,
        lastSeenAt: now,
      });
    }

    return commentId;
  },
});

export const update = workspaceMutation({
  args: {
    commentId: v.id("resourceComment"),
    content: v.string(),
    mentions: v.optional(v.array(v.id("user"))),
  },
  handler: async (ctx, args) => {
    const trimmed = args.content.trim();
    if (!trimmed) {
      throw new ConvexError("Comment cannot be empty");
    }

    const comment = await ctx.db.get(args.commentId);
    if (
      !comment ||
      comment.workspaceId !== ctx.workspace._id ||
      comment.authorId !== ctx.user._id ||
      comment.deletedAt
    ) {
      throw new ConvexError("Comment not found");
    }

    await ctx.db.patch(args.commentId, {
      content: trimmed,
      mentions: args.mentions,
      editedAt: Date.now(),
    });
  },
});

export const remove = workspaceMutation({
  args: {
    commentId: v.id("resourceComment"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Comment not found");
    }

    const isAuthor = comment.authorId === ctx.user._id;
    const isOwner = ctx.workspace.ownerId === ctx.user._id;
    if (!(isAuthor || isOwner)) {
      throw new ConvexError("Not authorized");
    }

    await ctx.db.patch(args.commentId, { deletedAt: Date.now() });
  },
});

export const markRead = workspaceMutation({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Resource not found");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("resourceCommentRead")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", ctx.user._id).eq("resourceId", args.resourceId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("resourceCommentRead", {
        userId: ctx.user._id,
        resourceId: args.resourceId,
        workspaceId: ctx.workspace._id,
        lastSeenAt: now,
      });
    }
  },
});

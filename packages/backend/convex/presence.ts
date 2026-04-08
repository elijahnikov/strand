import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return await presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return await presence.disconnect(ctx, sessionToken);
  },
});

export const removeRoomUser = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) =>
    await presence.removeRoomUser(ctx, roomId, userId),
});

export const getUsersInRoom = query({
  args: { userIds: v.array(v.id("user")) },
  handler: async (ctx, { userIds }) => {
    if (userIds.length === 0) {
      return [];
    }
    const users = await Promise.all(
      userIds.map(async (userId) => await ctx.db.get(userId))
    );
    return users;
  },
});

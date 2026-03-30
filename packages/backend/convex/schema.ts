import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // USER
  user: defineTable({
    username: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    onboardedAt: v.optional(v.number()),
    onboardingStep: v.number(),
  }).index("by_email", ["email"]),
  // WORKSPACE
  workspace: defineTable({
    name: v.string(),
    ownerId: v.id("user"),
    icon: v.optional(v.string()),
    emoji: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_deleted_at", ["deletedAt"]),
  // WORKSPACE MEMBER
  workspaceMember: defineTable({
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    lastAccessedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_user_last_accessed", ["userId", "lastAccessedAt"])
    .index("by_workspace_user", ["workspaceId", "userId"]),
});

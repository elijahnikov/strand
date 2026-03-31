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

  // RESOURCE (base table)
  resource: defineTable({
    workspaceId: v.id("workspace"),
    createdBy: v.id("user"),
    type: v.union(v.literal("website"), v.literal("note"), v.literal("file")),
    title: v.string(),
    description: v.optional(v.string()),
    isFavorite: v.boolean(),
    isPinned: v.boolean(),
    isArchived: v.boolean(),
    deletedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId", "deletedAt"])
    .index("by_workspace_type", ["workspaceId", "type", "deletedAt"])
    .index("by_workspace_favorite", ["workspaceId", "isFavorite", "deletedAt"])
    .index("by_workspace_archived", ["workspaceId", "isArchived", "deletedAt"])
    .index("by_workspace_creator", ["workspaceId", "createdBy", "deletedAt"])
    .index("by_workspace_pinned", ["workspaceId", "isPinned", "deletedAt"]),

  // WEBSITE RESOURCE
  websiteResource: defineTable({
    resourceId: v.id("resource"),
    url: v.string(),
    domain: v.optional(v.string()),
    favicon: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    siteName: v.optional(v.string()),
    fullScreenshotStorageId: v.optional(v.id("_storage")),
    isEmbeddable: v.boolean(),
    embedType: v.optional(
      v.union(
        v.literal("youtube"),
        v.literal("tweet"),
        v.literal("reddit"),
        v.literal("spotify"),
        v.literal("github_gist"),
        v.literal("codepen")
      )
    ),
    embedId: v.optional(v.string()),
    metadataStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    metadataError: v.optional(v.string()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_domain", ["resourceId", "domain"]),

  // NOTE RESOURCE
  noteResource: defineTable({
    resourceId: v.id("resource"),
    htmlContent: v.optional(v.string()),
    jsonContent: v.optional(v.string()),
    plainTextContent: v.optional(v.string()),
  }).index("by_resource", ["resourceId"]),

  // FILE RESOURCE
  fileResource: defineTable({
    resourceId: v.id("resource"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    thumbnailStorageId: v.optional(v.id("_storage")),
  })
    .index("by_resource", ["resourceId"])
    .index("by_mime_type", ["resourceId", "mimeType"]),

  // RESOURCE AI
  resourceAI: defineTable({
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    extractedEntities: v.optional(v.array(v.string())),
    sentiment: v.optional(v.string()),
    language: v.optional(v.string()),
    category: v.optional(v.string()),
    keyQuotes: v.optional(v.array(v.string())),
    relatedResourceIds: v.optional(v.array(v.id("resource"))),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // RESOURCE EMBEDDING
  resourceEmbedding: defineTable({
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    embedding: v.array(v.float64()),
    model: v.string(),
    inputHash: v.optional(v.string()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_workspace", ["workspaceId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId"],
    }),

  // TAG
  tag: defineTable({
    workspaceId: v.id("workspace"),
    name: v.string(),
    color: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"]),

  // RESOURCE TAG (junction)
  resourceTag: defineTable({
    resourceId: v.id("resource"),
    tagId: v.id("tag"),
    workspaceId: v.id("workspace"),
  })
    .index("by_resource", ["resourceId"])
    .index("by_tag", ["tagId"])
    .index("by_workspace_tag", ["workspaceId", "tagId"]),
});

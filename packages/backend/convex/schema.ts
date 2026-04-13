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
    iconColor: v.optional(v.string()),
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

  // WORKSPACE INVITATION
  workspaceInvitation: defineTable({
    workspaceId: v.id("workspace"),
    invitedEmail: v.string(),
    invitedUserId: v.optional(v.id("user")),
    invitedByUserId: v.id("user"),
    role: v.union(v.literal("admin"), v.literal("member")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked")
    ),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId", "status"])
    .index("by_invited_email", ["invitedEmail", "status"])
    .index("by_invited_user", ["invitedUserId", "status"])
    .index("by_workspace_email", ["workspaceId", "invitedEmail"]),

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
    collectionId: v.optional(v.id("collection")),
  })
    .index("by_workspace", ["workspaceId", "deletedAt"])
    .index("by_workspace_collection", [
      "workspaceId",
      "collectionId",
      "deletedAt",
    ])
    .index("by_workspace_collection_title", [
      "workspaceId",
      "collectionId",
      "deletedAt",
      "title",
    ])
    .index("by_workspace_collection_type", [
      "workspaceId",
      "collectionId",
      "type",
      "deletedAt",
    ])
    .index("by_workspace_collection_type_title", [
      "workspaceId",
      "collectionId",
      "type",
      "deletedAt",
      "title",
    ])
    .index("by_workspace_type", ["workspaceId", "type", "deletedAt"])
    .index("by_workspace_title", ["workspaceId", "deletedAt", "title"])
    .index("by_workspace_type_title", [
      "workspaceId",
      "type",
      "deletedAt",
      "title",
    ])
    .index("by_workspace_favorite", ["workspaceId", "isFavorite", "deletedAt"])
    .index("by_workspace_archived", ["workspaceId", "isArchived", "deletedAt"])
    .index("by_workspace_creator", ["workspaceId", "createdBy", "deletedAt"])
    .index("by_workspace_pinned", ["workspaceId", "isPinned", "deletedAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["workspaceId", "type", "deletedAt"],
    }),

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
    articleContent: v.optional(v.string()),
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

  // RESOURCE CONTENT (editor content for all resource types)
  resourceContent: defineTable({
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
    extractedText: v.optional(v.string()),
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

  // RESOURCE CHUNK (content chunks with per-chunk embeddings for RAG)
  resourceChunk: defineTable({
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
    model: v.string(),
    startOffset: v.number(),
    endOffset: v.number(),
    metadata: v.optional(
      v.object({
        pageNumber: v.optional(v.number()),
        sectionHeader: v.optional(v.string()),
      })
    ),
    contentHash: v.string(),
  })
    .index("by_resource", ["resourceId"])
    .index("by_resource_chunk", ["resourceId", "chunkIndex"])
    .index("by_workspace", ["workspaceId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId"],
    }),

  // USER RESOURCE PIN (per-user pins, not workspace-wide)
  userResourcePin: defineTable({
    userId: v.id("user"),
    resourceId: v.id("resource"),
    workspaceId: v.id("workspace"),
    pinnedAt: v.number(),
  })
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_user_resource", ["userId", "resourceId"]),

  // CONCEPT (AI-extracted canonical concepts with embeddings for dedup)
  concept: defineTable({
    workspaceId: v.id("workspace"),
    name: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId"],
    }),

  // RESOURCE CONCEPT (junction: resource <-> concept with importance weight)
  resourceConcept: defineTable({
    resourceId: v.id("resource"),
    conceptId: v.id("concept"),
    workspaceId: v.id("workspace"),
    importance: v.float64(),
  })
    .index("by_resource", ["resourceId"])
    .index("by_concept", ["conceptId"])
    .index("by_workspace", ["workspaceId"]),

  // RESOURCE LINK (scored bidirectional links between resources)
  resourceLink: defineTable({
    workspaceId: v.id("workspace"),
    sourceResourceId: v.id("resource"),
    targetResourceId: v.id("resource"),
    score: v.float64(),
    conceptOverlap: v.float64(),
    semanticSimilarity: v.float64(),
    sharedConcepts: v.array(v.string()),
    status: v.union(v.literal("auto"), v.literal("pinned")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source", ["sourceResourceId", "status"])
    .index("by_target", ["targetResourceId", "status"])
    .index("by_workspace", ["workspaceId"])
    .index("by_source_target", ["sourceResourceId", "targetResourceId"]),

  // TAG
  tag: defineTable({
    workspaceId: v.id("workspace"),
    name: v.string(),
    color: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["workspaceId"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId"],
    }),

  // COLLECTION (folder)
  collection: defineTable({
    workspaceId: v.id("workspace"),
    parentId: v.optional(v.id("collection")),
    name: v.string(),
    icon: v.optional(v.string()),
    createdBy: v.id("user"),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId", "deletedAt"])
    .index("by_workspace_parent", ["workspaceId", "parentId", "deletedAt"])
    .index("by_workspace_name", ["workspaceId", "deletedAt", "name"]),

  // RESOURCE TAG (junction)
  resourceTag: defineTable({
    resourceId: v.id("resource"),
    tagId: v.id("tag"),
    workspaceId: v.id("workspace"),
  })
    .index("by_resource", ["resourceId"])
    .index("by_tag", ["tagId"])
    .index("by_workspace_tag", ["workspaceId", "tagId"]),

  // CHAT THREAD
  chatThread: defineTable({
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    title: v.optional(v.string()),
    resourceId: v.optional(v.id("resource")),
    lastMessageAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_workspace_user", [
      "workspaceId",
      "userId",
      "deletedAt",
      "lastMessageAt",
    ])
    .index("by_workspace_resource", ["workspaceId", "resourceId", "deletedAt"]),

  // USER MEMORY (per user + workspace profile used as persistent chat context)
  userMemory: defineTable({
    workspaceId: v.id("workspace"),
    userId: v.id("user"),
    content: v.string(),
    status: v.union(v.literal("idle"), v.literal("extracting")),
    version: v.number(),
    lastExtractedAt: v.optional(v.number()),
    lastManualEditAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user_workspace", ["workspaceId", "userId"]),

  // EXTENSION TOKEN (long-lived bearer tokens for the browser extension)
  extensionToken: defineTable({
    userId: v.id("user"),
    defaultWorkspaceId: v.optional(v.id("workspace")),
    tokenHash: v.string(),
    label: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "revokedAt"])
    .index("by_hash", ["tokenHash"]),

  // CHAT MESSAGE
  chatMessage: defineTable({
    threadId: v.id("chatThread"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          resourceId: v.id("resource"),
          title: v.string(),
          type: v.string(),
          snippet: v.optional(v.string()),
          chunkIndex: v.optional(v.number()),
        })
      )
    ),
    // Persisted AI SDK tool parts (one per tool result the model emitted in
    // this assistant message). Stored as opaque JSON so adding new tools
    // doesn't require schema changes — each part is shaped like the live
    // UIMessage tool part: { type: "tool-${name}", state, toolCallId, input,
    // output }. Tool-specific UI components read their own output shape.
    toolParts: v.optional(v.array(v.any())),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),
});

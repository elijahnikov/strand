import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { createResourceForImport } from "../resource/mutations";

const IMPORT_RECORD = v.object({
  sourceItemId: v.string(),
  type: v.union(v.literal("website"), v.literal("note"), v.literal("file")),
  title: v.string(),
  description: v.optional(v.string()),
  url: v.optional(v.string()),
  htmlContent: v.optional(v.string()),
  jsonContent: v.optional(v.string()),
  plainTextContent: v.optional(v.string()),
  collectionPath: v.optional(v.array(v.string())),
  tagNames: v.optional(v.array(v.string())),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  isFavorite: v.optional(v.boolean()),
  isArchived: v.optional(v.boolean()),
  attachment: v.optional(
    v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      fileSize: v.number(),
      mimeType: v.string(),
    })
  ),
});

export const getJob = internalQuery({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => ctx.db.get(args.jobId),
});

export const setJobStatus = internalMutation({
  args: {
    jobId: v.id("importJob"),
    status: v.union(
      v.literal("uploading"),
      v.literal("queued"),
      v.literal("parsing"),
      v.literal("importing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorSummary: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    rootCollectionId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    const { jobId, ...patch } = args;
    await ctx.db.patch(jobId, patch);
  },
});

export const ensureRootCollection = internalMutation({
  args: {
    jobId: v.id("importJob"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }
    if (job.rootCollectionId) {
      return job.rootCollectionId;
    }
    const collectionId = await ctx.db.insert("collection", {
      workspaceId: job.workspaceId,
      name: args.name,
      createdBy: job.userId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(args.jobId, { rootCollectionId: collectionId });
    return collectionId;
  },
});

export const setTotal = internalMutation({
  args: { jobId: v.id("importJob"), total: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return;
    }
    await ctx.db.patch(args.jobId, {
      counts: { ...job.counts, total: args.total },
    });
  },
});

export const insertBatch = internalMutation({
  args: {
    jobId: v.id("importJob"),
    records: v.array(IMPORT_RECORD),
    rootCollectionId: v.optional(v.id("collection")),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status === "cancelled") {
      return { imported: 0, skipped: 0, failed: 0, websiteIds: [] };
    }

    const { source, workspaceId, userId } = job;
    const dedupe = job.options?.dedupe ?? true;

    const collectionCache = new Map<string, Id<"collection">>();
    const tagCache = new Map<string, Id<"tag">>();

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { item: string; error: string }[] = [];
    const websiteIds: Id<"resource">[] = [];

    for (const rec of args.records) {
      try {
        const importedFrom = `${source}:${rec.sourceItemId}`;

        if (dedupe) {
          const existing = await ctx.db
            .query("resource")
            .withIndex("by_workspace_imported_from", (q) =>
              q.eq("workspaceId", workspaceId).eq("importedFrom", importedFrom)
            )
            .first();
          if (existing) {
            skipped += 1;
            continue;
          }
        }

        const collectionId = await resolveCollectionPath(
          ctx,
          workspaceId,
          userId,
          args.rootCollectionId,
          rec.collectionPath,
          collectionCache
        );

        const resourceId = await createResourceForImport(ctx, {
          workspaceId,
          userId,
          type: rec.type,
          title: rec.title,
          description: rec.description,
          url: rec.url,
          htmlContent: rec.htmlContent,
          jsonContent: rec.jsonContent,
          plainTextContent: rec.plainTextContent,
          collectionId,
          importedFrom,
          createdAt: rec.createdAt,
          isFavorite: rec.isFavorite,
          isArchived: rec.isArchived,
          storageId: rec.attachment?.storageId,
          fileName: rec.attachment?.fileName,
          fileSize: rec.attachment?.fileSize,
          mimeType: rec.attachment?.mimeType,
        });

        if (rec.tagNames && rec.tagNames.length > 0) {
          await attachTags(
            ctx,
            workspaceId,
            resourceId,
            rec.tagNames,
            tagCache
          );
        }

        if (rec.type === "website") {
          websiteIds.push(resourceId);
        }

        imported += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          item: rec.title || rec.sourceItemId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const patchedCounts = {
      ...job.counts,
      parsed: job.counts.parsed + args.records.length,
      imported: job.counts.imported + imported,
      skipped: job.counts.skipped + skipped,
      failed: job.counts.failed + failed,
    };

    if (errors.length > 0) {
      const existing = job.errorSamples ?? [];
      const merged = [...existing, ...errors].slice(0, 20);
      await ctx.db.patch(args.jobId, {
        counts: patchedCounts,
        errorSamples: merged,
      });
    } else {
      await ctx.db.patch(args.jobId, { counts: patchedCounts });
    }

    return { imported, skipped, failed, websiteIds };
  },
});

async function resolveCollectionPath(
  ctx: MutationCtx,
  workspaceId: Id<"workspace">,
  userId: Id<"user">,
  rootCollectionId: Id<"collection"> | undefined,
  path: string[] | undefined,
  cache: Map<string, Id<"collection">>
): Promise<Id<"collection"> | undefined> {
  if (!path || path.length === 0) {
    return rootCollectionId;
  }

  let parentId: Id<"collection"> | undefined = rootCollectionId;
  for (const name of path) {
    if (!name) {
      continue;
    }
    const cacheKey = `${parentId ?? "root"}::${name}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      parentId = cached;
      continue;
    }

    const siblings = await ctx.db
      .query("collection")
      .withIndex("by_workspace_parent", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("parentId", parentId)
          .eq("deletedAt", undefined)
      )
      .collect();

    let matched = siblings.find((c) => c.name === name)?._id;

    if (!matched) {
      matched = await ctx.db.insert("collection", {
        workspaceId,
        parentId,
        name,
        createdBy: userId,
        updatedAt: Date.now(),
      });
    }

    cache.set(cacheKey, matched);
    parentId = matched;
  }

  return parentId;
}

async function attachTags(
  ctx: MutationCtx,
  workspaceId: Id<"workspace">,
  resourceId: Id<"resource">,
  tagNames: string[],
  cache: Map<string, Id<"tag">>
): Promise<void> {
  for (const raw of tagNames) {
    const name = raw.trim().toLowerCase();
    if (!name) {
      continue;
    }
    let tagId = cache.get(name);
    if (!tagId) {
      const existing = await ctx.db
        .query("tag")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", workspaceId).eq("name", name)
        )
        .unique();
      if (existing) {
        tagId = existing._id;
      } else {
        tagId = await ctx.db.insert("tag", {
          workspaceId,
          name,
        });
      }
      cache.set(name, tagId);
    }
    await ctx.db.insert("resourceTag", {
      resourceId,
      tagId,
      workspaceId,
    });
  }
}

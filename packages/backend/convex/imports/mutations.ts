import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { workspaceMutation } from "../utils";

const SOURCE_UNION = v.union(
  v.literal("markdown_zip"),
  v.literal("notion_zip"),
  v.literal("evernote_enex"),
  v.literal("readwise_api"),
  v.literal("url_csv"),
  v.literal("bookmark_html"),
  v.literal("fabric"),
  v.literal("mymind"),
  v.literal("notion_oauth"),
  v.literal("raindrop_oauth")
);

const OPTIONS = v.object({
  createRootCollection: v.boolean(),
  rootCollectionName: v.optional(v.string()),
  rehydrateUrls: v.boolean(),
  dedupe: v.boolean(),
  cherryPickPaths: v.optional(v.array(v.string())),
});

export const startImport = workspaceMutation({
  args: {
    source: SOURCE_UNION,
    uiSourceId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    connectionId: v.optional(v.id("connection")),
    options: v.optional(OPTIONS),
  },
  rateLimit: "startImport",
  handler: async (ctx, args) => {
    if (!(args.storageId || args.connectionId)) {
      throw new ConvexError("Either storageId or connectionId is required");
    }

    const jobId = await ctx.db.insert("importJob", {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      source: args.source,
      uiSourceId: args.uiSourceId,
      status: "queued",
      storageId: args.storageId,
      connectionId: args.connectionId,
      options: args.options,
      counts: {
        total: 0,
        parsed: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
      },
      startedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.imports.pipeline.runImport, {
      jobId,
    });

    return jobId;
  },
});

export const cancelImport = workspaceMutation({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Import not found");
    }
    if (job.status === "completed" || job.status === "failed") {
      return;
    }
    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

export const deleteImport = workspaceMutation({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Import not found");
    }
    await ctx.db.delete(args.jobId);
  },
});

export const enrichImportJob = workspaceMutation({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== ctx.workspace._id) {
      throw new ConvexError("Import not found");
    }

    const prefix = `${job.source}:`;
    const resources = await ctx.db
      .query("resource")
      .withIndex("by_workspace_imported_from", (q) =>
        q.eq("workspaceId", ctx.workspace._id)
      )
      .collect();

    let scheduled = 0;
    for (const resource of resources) {
      if (!resource.importedFrom?.startsWith(prefix)) {
        continue;
      }
      const ai = await ctx.db
        .query("resourceAI")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (!ai || ai.status !== "skipped") {
        continue;
      }
      await ctx.db.patch(ai._id, { status: "pending" });
      await ctx.scheduler.runAfter(
        0,
        internal.resource.aiActions.processResourceAI,
        { resourceId: resource._id }
      );
      scheduled += 1;
    }
    return { scheduled };
  },
});

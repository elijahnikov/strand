"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { parseBookmarkHtml } from "./parsers/bookmarkHtml";
import { parseUrlCsv } from "./parsers/csv";
import { parseEvernoteEnex } from "./parsers/evernoteEnex";
import { parseFabricZip } from "./parsers/fabric";
import { parseMarkdownZip } from "./parsers/markdown";
import { parseNotionApi } from "./parsers/notionApi";
import { parseNotionZip } from "./parsers/notionZip";
import { parseRaindropApi } from "./parsers/raindropApi";
import { parseReadwise } from "./parsers/readwise";
import type { ImportParser, ImportRecord, ImportYield } from "./parsers/types";
import { isImportError } from "./parsers/types";

interface ResolvedAttachment {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageId: Id<"_storage">;
}

type ResolvedRecord = Omit<ImportRecord, "attachment"> & {
  attachment?: ResolvedAttachment;
};

const BATCH_SIZE = 50;

const PARSERS: Record<string, ImportParser | undefined> = {
  markdown_zip: parseMarkdownZip,
  url_csv: parseUrlCsv,
  mymind: parseUrlCsv,
  bookmark_html: parseBookmarkHtml,
  readwise_api: parseReadwise,
  evernote_enex: parseEvernoteEnex,
  notion_zip: parseNotionZip,
  fabric: parseFabricZip,
  notion_oauth: parseNotionApi,
  raindrop_oauth: parseRaindropApi,
};

export const runImport = internalAction({
  args: { jobId: v.id("importJob") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.imports.internals.getJob, {
      jobId: args.jobId,
    });
    if (!job) {
      return;
    }
    if (
      job.status === "cancelled" ||
      job.status === "completed" ||
      job.status === "failed"
    ) {
      return;
    }

    try {
      await ctx.runMutation(internal.imports.internals.setJobStatus, {
        jobId: args.jobId,
        status: "parsing",
      });

      const parser = PARSERS[job.source];
      if (!parser) {
        throw new Error(`No parser for source "${job.source}"`);
      }

      let iterator: AsyncIterable<ImportYield>;
      if (parser.kind === "file") {
        if (!job.storageId) {
          throw new Error("File-based import requires a storageId");
        }
        const blob = await ctx.storage.get(job.storageId);
        if (!blob) {
          throw new Error("Uploaded file is no longer available");
        }
        iterator = parser.parse({ blob });
      } else {
        if (!job.connectionId) {
          throw new Error("Token-based import requires a connectionId");
        }
        const tokenInfo = await ctx.runQuery(
          internal.connections.internals.getActiveToken,
          {
            connectionId: job.connectionId,
            userId: job.userId,
            requiredProvider: providerForSource(job.source),
          }
        );
        iterator = parser.parse({ token: tokenInfo.accessToken });
      }

      let rootCollectionId: Id<"collection"> | undefined;
      if (job.options?.createRootCollection) {
        const name =
          job.options.rootCollectionName?.trim() || defaultRootName(job.source);
        rootCollectionId =
          (await ctx.runMutation(
            internal.imports.internals.ensureRootCollection,
            { jobId: args.jobId, name }
          )) ?? undefined;
      }

      await ctx.runMutation(internal.imports.internals.setJobStatus, {
        jobId: args.jobId,
        status: "importing",
      });

      const allWebsiteIds: Id<"resource">[] = [];
      let batch: ResolvedRecord[] = [];

      const flush = async () => {
        if (batch.length === 0) {
          return;
        }
        const result = await ctx.runMutation(
          internal.imports.internals.insertBatch,
          {
            jobId: args.jobId,
            records: batch,
            rootCollectionId,
          }
        );
        allWebsiteIds.push(...result.websiteIds);
        batch = [];
      };

      for await (const yielded of iterator) {
        if (isImportError(yielded)) {
          continue;
        }
        const resolved = await resolveAttachment(ctx, yielded);
        batch.push(resolved);
        if (batch.length >= BATCH_SIZE) {
          await flush();
        }
      }
      await flush();

      if (allWebsiteIds.length > 0 && (job.options?.rehydrateUrls ?? true)) {
        await ctx.scheduler.runAfter(
          0,
          internal.imports.rehydrate.scheduleRehydration,
          { resourceIds: allWebsiteIds }
        );
      }

      await ctx.runMutation(internal.imports.internals.setJobStatus, {
        jobId: args.jobId,
        status: "completed",
        completedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.imports.internals.setJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorSummary: message,
        completedAt: Date.now(),
      });
    }
  },
});

async function resolveAttachment(
  ctx: { storage: { store: (blob: Blob) => Promise<Id<"_storage">> } },
  record: ImportRecord
): Promise<ResolvedRecord> {
  if (!record.attachment) {
    return record as ResolvedRecord;
  }
  const { bytes, fileName, mimeType } = record.attachment;
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: mimeType });
  const storageId = await ctx.storage.store(blob);
  const { attachment: _drop, ...rest } = record;
  return {
    ...rest,
    attachment: {
      storageId,
      fileName,
      fileSize: bytes.byteLength,
      mimeType,
    },
  };
}

function providerForSource(
  source: string
): "readwise" | "notion" | "raindrop" | "google_drive" {
  switch (source) {
    case "readwise_api":
      return "readwise";
    case "notion_oauth":
      return "notion";
    case "raindrop_oauth":
      return "raindrop";
    default:
      throw new Error(`No provider mapping for source "${source}"`);
  }
}

function defaultRootName(source: string): string {
  switch (source) {
    case "markdown_zip":
      return "Imported from Markdown";
    case "notion_zip":
      return "Imported from Notion";
    case "evernote_enex":
      return "Imported from Evernote";
    case "readwise_api":
      return "Imported from Readwise";
    case "url_csv":
      return "Imported bookmarks";
    case "bookmark_html":
      return "Imported browser bookmarks";
    case "fabric":
      return "Imported from Fabric";
    case "mymind":
      return "Imported from MyMind";
    case "notion_oauth":
      return "Imported from Notion";
    case "raindrop_oauth":
      return "Imported from Raindrop";
    default:
      return "Imported";
  }
}

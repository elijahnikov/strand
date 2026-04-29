import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { enrichResource } from "../resource/queries";
import { workspaceQuery } from "../utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAYS_CONCEPTS_LIMIT = 8;

function assertValidDateString(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new ConvexError("Invalid date format, expected YYYY-MM-DD");
  }
}

function startOfDayMs(date: string, timeZone: string): number {
  // Compute the UTC ms for 00:00 in the given IANA timezone for the given date.
  // Strategy: ask the formatter how the candidate UTC midnight renders in `tz`,
  // then nudge by the offset until it matches.
  const utcMidnight = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10))
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(utcMidnight));
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    lookup[part.type] = part.value;
  }
  const localAsUtcMs = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour === "24" ? "0" : lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  const offset = localAsUtcMs - utcMidnight;
  return utcMidnight - offset;
}

async function topConceptsForResources(
  ctx: QueryCtx,
  resources: Doc<"resource">[],
  limit: number
): Promise<Array<{ _id: Id<"concept">; name: string; importance: number }>> {
  const totals = new Map<Id<"concept">, number>();
  for (const resource of resources) {
    const links = await ctx.db
      .query("resourceConcept")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .collect();
    for (const link of links) {
      totals.set(
        link.conceptId,
        (totals.get(link.conceptId) ?? 0) + link.importance
      );
    }
  }

  const ranked = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const concepts = await Promise.all(
    ranked.map(async ([conceptId, importance]) => {
      const concept = await ctx.db.get(conceptId);
      if (!concept) {
        return null;
      }
      return { _id: concept._id, name: concept.name, importance };
    })
  );

  return concepts.filter(
    (c): c is { _id: Id<"concept">; name: string; importance: number } =>
      c !== null
  );
}

export const get = workspaceQuery({
  args: {
    date: v.string(),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    assertValidDateString(args.date);

    const note = await ctx.db
      .query("resource")
      .withIndex("by_workspace_dailyNoteDate", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("dailyNoteDate", args.date)
      )
      .unique();

    const startMs = startOfDayMs(args.date, args.timeZone);
    const endMs = startMs + DAY_MS;

    const allWorkspaceResources = await ctx.db
      .query("resource")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspace._id))
      .collect();

    const todaysSaves = allWorkspaceResources.filter(
      (r) =>
        !r.deletedAt &&
        r._creationTime >= startMs &&
        r._creationTime < endMs &&
        !r.dailyNoteDate
    );

    todaysSaves.sort((a, b) => b._creationTime - a._creationTime);

    const todaysConcepts = await topConceptsForResources(
      ctx,
      todaysSaves,
      TODAYS_CONCEPTS_LIMIT
    );

    const enrichedSaves = await Promise.all(
      todaysSaves.map((resource) => buildSavedTodayCard(ctx, resource))
    );

    return {
      noteResourceId: note?._id ?? null,
      todaysSaves: enrichedSaves,
      todaysConcepts,
    };
  },
});

interface SavedTodayCard {
  _id: Id<"resource">;
  createdAt: number;
  preview: {
    domain?: string | null;
    favicon?: string | null;
    fileName?: string | null;
    fileUrl?: string | null;
    mimeType?: string | null;
    ogImage?: string | null;
    plainTextSnippet?: string | null;
    summary?: string | null;
  };
  title: string;
  type: "website" | "note" | "file";
}

async function buildSavedTodayCard(
  ctx: QueryCtx,
  resource: Doc<"resource">
): Promise<SavedTodayCard> {
  const preview: SavedTodayCard["preview"] = {};

  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (website) {
        preview.ogImage = website.ogImage;
        preview.favicon = website.favicon;
        preview.domain = website.domain;
      }
      break;
    }
    case "file": {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (file) {
        preview.mimeType = file.mimeType;
        preview.fileName = file.fileName;
        if (file.mimeType?.startsWith("image/") && file.storageId) {
          preview.fileUrl = await ctx.storage.getUrl(file.storageId);
        }
      }
      break;
    }
    case "note": {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (note?.plainTextContent) {
        preview.plainTextSnippet = note.plainTextContent.slice(0, 140);
      }
      break;
    }
    default:
      break;
  }

  const ai = await ctx.db
    .query("resourceAI")
    .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
    .unique();
  if (ai?.summary) {
    preview.summary = ai.summary;
  }

  return {
    _id: resource._id,
    title: resource.title,
    type: resource.type,
    createdAt: resource._creationTime,
    preview,
  };
}

export const list = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("resource")
      .withIndex("by_workspace_dailyNoteDate", (q) =>
        q.eq("workspaceId", ctx.workspace._id)
      )
      .collect();

    const live = rows.filter((r) => !r.deletedAt && r.dailyNoteDate);
    live.sort((a, b) =>
      (b.dailyNoteDate as string).localeCompare(a.dailyNoteDate as string)
    );

    return await Promise.all(live.map((r) => enrichResource(ctx, r)));
  },
});

export const getByDate = workspaceQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!DATE_PATTERN.test(args.date)) {
      return null;
    }
    const note = await ctx.db
      .query("resource")
      .withIndex("by_workspace_dailyNoteDate", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("dailyNoteDate", args.date)
      )
      .unique();
    if (!note || note.deletedAt) {
      return null;
    }
    return note._id;
  },
});

export const listForMonth = workspaceQuery({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.month < 1 || args.month > 12) {
      throw new ConvexError("Invalid month");
    }
    const prefix = `${args.year}-${String(args.month).padStart(2, "0")}`;

    const rows = await ctx.db
      .query("resource")
      .withIndex("by_workspace_dailyNoteDate", (q) =>
        q.eq("workspaceId", ctx.workspace._id)
      )
      .collect();

    return rows
      .filter(
        (r) =>
          !r.deletedAt && r.dailyNoteDate && r.dailyNoteDate.startsWith(prefix)
      )
      .map((r) => r.dailyNoteDate as string)
      .sort();
  },
});

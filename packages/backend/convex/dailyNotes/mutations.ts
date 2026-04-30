import { ConvexError, v } from "convex/values";
import { createResource } from "../resource/mutations";
import { workspaceMutation } from "../utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_BLOCKNOTE_JSON = JSON.stringify([
  { type: "paragraph", content: [] },
]);

function assertValidDateString(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new ConvexError("Invalid date format, expected YYYY-MM-DD");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConvexError("Invalid date");
  }
  const roundTrip = parsed.toISOString().slice(0, 10);
  if (roundTrip !== date) {
    throw new ConvexError("Invalid date");
  }
}

function formatDateTitle(date: string): string {
  // "2026-04-29" -> "April 29, 2026"
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const getOrCreate = workspaceMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    assertValidDateString(args.date);

    const candidates = await ctx.db
      .query("resource")
      .withIndex("by_workspace_dailyNoteDate", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("dailyNoteDate", args.date)
      )
      .collect();

    const live = candidates.find((r) => !r.deletedAt);
    if (live) {
      return live._id;
    }

    return await createResource(ctx, {
      type: "note",
      title: formatDateTitle(args.date),
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      dailyNoteDate: args.date,
      htmlContent: "",
      jsonContent: EMPTY_BLOCKNOTE_JSON,
      plainTextContent: "",
    });
  },
});

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { JournalPageComponent } from "~/components/pages/journal-page";
import { isValidDateString } from "~/lib/format";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/journal/$date"
)({
  beforeLoad: async ({ context, params }) => {
    if (!isValidDateString(params.date)) {
      throw redirect({
        to: "/workspace/$workspaceId/journal",
        params: { workspaceId: params.workspaceId },
      });
    }
    const resourceId = await context.queryClient.ensureQueryData(
      convexQuery(api.dailyNotes.queries.getByDate, {
        workspaceId: params.workspaceId as Id<"workspace">,
        date: params.date,
      })
    );
    if (resourceId) {
      throw redirect({
        to: "/workspace/$workspaceId/resource/$resourceId",
        params: { workspaceId: params.workspaceId, resourceId },
      });
    }
  },
  component: JournalDateRoute,
});

function JournalDateRoute() {
  const { workspaceId, date } = Route.useParams();
  return (
    <JournalPageComponent
      selectedDate={date}
      workspaceId={workspaceId as Id<"workspace">}
    />
  );
}

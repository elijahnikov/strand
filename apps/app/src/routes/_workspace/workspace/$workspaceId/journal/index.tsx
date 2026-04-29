import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { JournalPageComponent } from "~/components/pages/journal-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/journal/"
)({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.dailyNotes.queries.list, {
        workspaceId: params.workspaceId as Id<"workspace">,
      })
    );
  },
  component: JournalIndex,
});

function JournalIndex() {
  const { workspaceId } = Route.useParams();
  return <JournalPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

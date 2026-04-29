import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { JournalPageComponent } from "~/components/pages/journal-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/journal/"
)({
  component: JournalIndex,
});

function JournalIndex() {
  const { workspaceId } = Route.useParams();
  return <JournalPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

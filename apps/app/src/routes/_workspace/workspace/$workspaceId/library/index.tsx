import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { LibraryPageComponent } from "~/components/pages/library-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library/"
)({
  component: LibraryPage,
});

function LibraryPage() {
  const { workspaceId } = Route.useParams();

  return <LibraryPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

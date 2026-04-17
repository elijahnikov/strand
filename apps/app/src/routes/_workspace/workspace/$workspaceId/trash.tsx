import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { TrashPageComponent } from "~/components/pages/trash-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/trash"
)({
  component: TrashPage,
});

function TrashPage() {
  const { workspaceId } = Route.useParams();
  return <TrashPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

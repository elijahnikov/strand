import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { SearchPageComponent } from "~/components/pages/search-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/search"
)({
  component: SearchPage,
});

function SearchPage() {
  const { workspaceId } = Route.useParams();
  return <SearchPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

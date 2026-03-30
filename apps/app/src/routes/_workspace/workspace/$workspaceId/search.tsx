import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/search"
)({
  component: SearchPage,
});

function SearchPage() {
  return <div>Search</div>;
}

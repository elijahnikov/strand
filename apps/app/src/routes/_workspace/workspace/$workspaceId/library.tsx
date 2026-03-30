import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library"
)({
  component: LibraryPage,
});

function LibraryPage() {
  return <div>Library</div>;
}

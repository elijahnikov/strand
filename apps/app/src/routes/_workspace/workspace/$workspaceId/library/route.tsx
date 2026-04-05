import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library"
)({
  component: LibraryLayout,
});

function LibraryLayout() {
  return <Outlet />;
}

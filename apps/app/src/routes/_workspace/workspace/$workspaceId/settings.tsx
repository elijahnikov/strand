import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/settings"
)({
  component: SettingsPage,
});

function SettingsPage() {
  return <div />;
}

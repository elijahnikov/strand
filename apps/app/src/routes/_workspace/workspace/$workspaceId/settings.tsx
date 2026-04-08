import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageComponent } from "~/components/pages/settings-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/settings"
)({
  component: SettingsPage,
});

function SettingsPage() {
  const { workspaceId } = Route.useParams();

  return <SettingsPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

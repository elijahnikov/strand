import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import {
  SettingsPageComponent,
  type SettingsTab,
} from "~/components/pages/settings-page";

const SETTINGS_TABS: readonly SettingsTab[] = [
  "general",
  "usage",
  "members",
  "memory",
  "import",
  "advanced",
];

interface Search {
  tab?: SettingsTab;
}

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/settings"
)({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const tab = SETTINGS_TABS.includes(search.tab as SettingsTab)
      ? (search.tab as SettingsTab)
      : undefined;
    return { tab };
  },
});

function SettingsPage() {
  const { workspaceId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <SettingsPageComponent
      onTabChange={(next) =>
        navigate({
          replace: true,
          search: { tab: next === "general" ? undefined : next },
        })
      }
      tab={tab ?? "general"}
      workspaceId={workspaceId as Id<"workspace">}
    />
  );
}

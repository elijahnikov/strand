import { createFileRoute } from "@tanstack/react-router";
import {
  UserSettingsPageComponent,
  type UserSettingsTab,
} from "~/components/pages/user-settings-page";

const USER_SETTINGS_TABS: readonly UserSettingsTab[] = [
  "general",
  "workspaces",
  "connections",
  "devices",
  "billing",
  "account",
];

interface Search {
  checkout?: "success" | "cancel";
  tab?: UserSettingsTab;
}

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const tab = USER_SETTINGS_TABS.includes(search.tab as UserSettingsTab)
      ? (search.tab as UserSettingsTab)
      : undefined;
    const checkout =
      search.checkout === "success" || search.checkout === "cancel"
        ? (search.checkout as "success" | "cancel")
        : undefined;
    return { tab, checkout };
  },
});

function AccountPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <UserSettingsPageComponent
      onTabChange={(next) =>
        navigate({
          replace: true,
          search: (prev) => ({
            ...prev,
            tab: next === "general" ? undefined : next,
          }),
        })
      }
      tab={tab ?? "general"}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsPageComponent } from "~/components/pages/user-settings-page";

export const Route = createFileRoute("/_workspace/account")({
  component: AccountPage,
});

function AccountPage() {
  return <UserSettingsPageComponent />;
}

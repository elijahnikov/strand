import {
  BrowserExtension,
  LaunchType,
  launchCommand,
  showHUD,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { api } from "~/lib/api";
import { NotConnectedError } from "~/lib/auth";

export default async function SaveTab(): Promise<void> {
  let tabs: Awaited<ReturnType<typeof BrowserExtension.getTabs>>;
  try {
    tabs = await BrowserExtension.getTabs();
  } catch (err) {
    await showFailureToast(err, {
      title: "Browser Extension required",
      message:
        "Install the Raycast Browser Extension to capture the current tab.",
    });
    return;
  }

  const active = tabs.find((tab) => tab.active) ?? tabs[0];
  if (!active?.url) {
    await showFailureToast(new Error("No active browser tab found"), {
      title: "Could not save tab",
    });
    return;
  }

  try {
    await api.captureWebsite({
      url: active.url,
      title: active.title?.trim() || undefined,
    });
    await showHUD("Saved to Omi ✓");
  } catch (err) {
    if (err instanceof NotConnectedError) {
      await launchCommand({
        name: "connect",
        type: LaunchType.UserInitiated,
      });
      return;
    }
    await showFailureToast(err, { title: "Could not save tab" });
  }
}

import {
  getPreferenceValues,
  type LaunchProps,
  LaunchType,
  open,
  popToRoot,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import {
  consumePendingConnectState,
  setAuth,
  setPendingConnectState,
} from "~/lib/auth";
import type { ConnectLaunchContext } from "~/lib/types";

const TRAILING_SLASH_RE = /\/$/;
const APP_URL_REGEX = /^https?:\/\//i;
const RAYCAST_AUTHOR = "omi";
const RAYCAST_EXTENSION = "omi";

function appUrl(): string {
  const { appUrl: value } = getPreferenceValues<Preferences.Connect>();
  const trimmed = value.trim().replace(TRAILING_SLASH_RE, "");
  if (!APP_URL_REGEX.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

function generateState(): string {
  return Math.random().toString(36).slice(2, 12);
}

async function startHandshake(): Promise<void> {
  const state = generateState();
  await setPendingConnectState(state);
  const params = new URLSearchParams({
    author: RAYCAST_AUTHOR,
    extension: RAYCAST_EXTENSION,
    state,
  });
  await open(`${appUrl()}/connect-raycast?${params.toString()}`);
  await showHUD("Opening omi to connect Raycast…");
}

async function completeHandshake(context: ConnectLaunchContext): Promise<void> {
  if (!(context.token && context.userId)) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Connection failed",
      message: "Missing token in handshake",
    });
    return;
  }

  const expectedState = await consumePendingConnectState();
  if (expectedState && context.state && expectedState !== context.state) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Connection failed",
      message: "State mismatch — please try again",
    });
    return;
  }

  await setAuth({
    token: context.token,
    userId: context.userId,
    defaultWorkspaceId: context.defaultWorkspaceId ?? null,
    expiresAt: context.expiresAt,
  });
  await showHUD("Connected to omi ✓");
  await popToRoot();
}

export default async function Connect(
  props: LaunchProps<{ launchContext?: ConnectLaunchContext }>
): Promise<void> {
  const context = props.launchContext;
  if (props.launchType === LaunchType.UserInitiated && !context) {
    await startHandshake();
    return;
  }
  if (context) {
    await completeHandshake(context);
  }
}

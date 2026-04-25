import { LocalStorage } from "@raycast/api";

const TOKEN_KEY = "omi.token";
const USER_ID_KEY = "omi.userId";
const DEFAULT_WORKSPACE_KEY = "omi.defaultWorkspaceId";
const EXPIRES_AT_KEY = "omi.expiresAt";
const PENDING_STATE_KEY = "omi.pendingConnectState";

export interface StoredAuth {
  defaultWorkspaceId: string | null;
  expiresAt: number;
  token: string;
  userId: string;
}

export class NotConnectedError extends Error {
  constructor() {
    super("Raycast is not connected to omi.");
    this.name = "NotConnectedError";
  }
}

export async function getAuth(): Promise<StoredAuth | null> {
  const token = await LocalStorage.getItem<string>(TOKEN_KEY);
  if (!token) {
    return null;
  }
  const userId = (await LocalStorage.getItem<string>(USER_ID_KEY)) ?? "";
  const defaultWorkspaceId =
    (await LocalStorage.getItem<string>(DEFAULT_WORKSPACE_KEY)) || null;
  const expiresAt =
    (await LocalStorage.getItem<number>(EXPIRES_AT_KEY)) ??
    Number.MAX_SAFE_INTEGER;
  if (expiresAt < Date.now()) {
    await clearAuth();
    return null;
  }
  return { token, userId, defaultWorkspaceId, expiresAt };
}

export async function requireAuth(): Promise<StoredAuth> {
  const auth = await getAuth();
  if (!auth) {
    throw new NotConnectedError();
  }
  return auth;
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await LocalStorage.setItem(TOKEN_KEY, auth.token);
  await LocalStorage.setItem(USER_ID_KEY, auth.userId);
  if (auth.defaultWorkspaceId) {
    await LocalStorage.setItem(DEFAULT_WORKSPACE_KEY, auth.defaultWorkspaceId);
  } else {
    await LocalStorage.removeItem(DEFAULT_WORKSPACE_KEY);
  }
  await LocalStorage.setItem(EXPIRES_AT_KEY, auth.expiresAt);
}

export async function clearAuth(): Promise<void> {
  await LocalStorage.removeItem(TOKEN_KEY);
  await LocalStorage.removeItem(USER_ID_KEY);
  await LocalStorage.removeItem(DEFAULT_WORKSPACE_KEY);
  await LocalStorage.removeItem(EXPIRES_AT_KEY);
}

export async function setPendingConnectState(state: string): Promise<void> {
  await LocalStorage.setItem(PENDING_STATE_KEY, state);
}

export async function consumePendingConnectState(): Promise<string | null> {
  const value = await LocalStorage.getItem<string>(PENDING_STATE_KEY);
  if (value) {
    await LocalStorage.removeItem(PENDING_STATE_KEY);
  }
  return value ?? null;
}

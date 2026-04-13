const TOKEN_KEY = "strand.auth.v1";

export interface StoredAuth {
  defaultWorkspaceId?: string;
  token: string;
  userId?: string;
}

export async function getToken(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  const stored = result[TOKEN_KEY] as StoredAuth | undefined;
  return stored ?? null;
}

export async function setToken(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: auth });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}

export function subscribeToAuth(
  callback: (auth: StoredAuth | null) => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "local" || !(TOKEN_KEY in changes)) {
      return;
    }
    const next = changes[TOKEN_KEY]?.newValue as StoredAuth | undefined;
    callback(next ?? null);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

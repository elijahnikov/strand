import { clearToken, getToken } from "@/lib/auth";

const SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

export class ExtensionApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ExtensionApiError";
  }
}

function siteUrl(): string {
  if (!SITE_URL) {
    throw new ExtensionApiError(
      0,
      "VITE_CONVEX_SITE_URL is not set in the extension build"
    );
  }
  return SITE_URL.replace(/\/$/, "");
}

async function authedFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const auth = await getToken();
  if (!auth) {
    throw new ExtensionApiError(401, "Extension is not connected");
  }
  const response = await fetch(`${siteUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
      authorization: `Bearer ${auth.token}`,
    },
  });
  if (response.status === 401) {
    await clearToken();
    throw new ExtensionApiError(
      401,
      "Extension session expired. Please reconnect."
    );
  }
  return response;
}

async function postJson<TBody, TResponse>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const response = await authedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text
    ? (JSON.parse(text) as TResponse | { error: string })
    : ({} as TResponse);
  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ExtensionApiError(response.status, message);
  }
  return parsed as TResponse;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await authedFetch(path, { method: "GET" });
  const text = await response.text();
  const parsed = text
    ? (JSON.parse(text) as TResponse | { error: string })
    : ({} as TResponse);
  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ExtensionApiError(response.status, message);
  }
  return parsed as TResponse;
}

export interface MeResponse {
  defaultWorkspaceId: string | null;
  userId: string;
  workspaces: Array<{
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    icon: string | null;
    emoji: string | null;
  }>;
}

export interface CaptureResponse {
  resourceId: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
}

export const api = {
  me: () => getJson<MeResponse>("/api/ext/me"),
  uploadUrl: () =>
    postJson<Record<string, never>, UploadUrlResponse>(
      "/api/ext/upload-url",
      {}
    ),
  captureWebsite: (body: {
    workspaceId?: string;
    url: string;
    title?: string;
    description?: string;
  }) =>
    postJson<typeof body, CaptureResponse>("/api/ext/capture/website", body),
  captureNote: (body: {
    workspaceId?: string;
    title: string;
    plainTextContent?: string;
    jsonContent?: string;
    htmlContent?: string;
  }) => postJson<typeof body, CaptureResponse>("/api/ext/capture/note", body),
  captureFile: (body: {
    workspaceId?: string;
    storageId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
    duration?: number;
    title?: string;
  }) => postJson<typeof body, CaptureResponse>("/api/ext/capture/file", body),
};

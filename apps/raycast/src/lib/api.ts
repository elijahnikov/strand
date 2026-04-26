import { getPreferenceValues } from "@raycast/api";
import { clearAuth, NotConnectedError, requireAuth } from "~/lib/auth";
import type {
  CaptureResponse,
  ListResourcesResponse,
  MeResponse,
} from "~/lib/types";

const TRAILING_SLASH_RE = /\/$/;
const APP_URL_REGEX = /^https?:\/\//i;

export class OmiApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OmiApiError";
    this.status = status;
  }
}

function siteUrl(): string {
  const { convexSiteUrl } = getPreferenceValues<Preferences>();
  if (!convexSiteUrl) {
    throw new OmiApiError(0, "Omi API URL is not set in extension preferences");
  }
  const trimmed = convexSiteUrl.trim().replace(TRAILING_SLASH_RE, "");
  if (!APP_URL_REGEX.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function authedFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const auth = await requireAuth();
  const response = await fetch(`${siteUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
      authorization: `Bearer ${auth.token}`,
    },
  });
  if (response.status === 401) {
    await clearAuth();
    throw new NotConnectedError();
  }
  return response;
}

async function readJsonOrError<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed && "error" in parsed
        ? (parsed as { error: string }).error
        : `Request failed (${response.status})`;
    throw new OmiApiError(response.status, message);
  }
  return parsed as T;
}

async function postJson<TBody, TResponse>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const response = await authedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return readJsonOrError<TResponse>(response);
}

async function getJson<TResponse>(
  path: string,
  search?: Record<string, string | number | undefined>
): Promise<TResponse> {
  const params = new URLSearchParams();
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }
  const query = params.toString();
  const fullPath = query ? `${path}?${query}` : path;
  const response = await authedFetch(fullPath, { method: "GET" });
  return readJsonOrError<TResponse>(response);
}

export const api = {
  me: () => getJson<MeResponse>("/api/ext/me"),
  listResources: (params: {
    search?: string;
    cursor?: string;
    type?: "website" | "note" | "file";
    limit?: number;
    workspaceId?: string;
  }) => getJson<ListResourcesResponse>("/api/ext/resources", params),
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
};

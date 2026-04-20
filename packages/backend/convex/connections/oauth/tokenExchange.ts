import type { OAuth2ProviderDescriptor } from "../providers/types";

export interface TokenResponse {
  accessToken: string;
  expiresAt?: number;
  refreshToken?: string;
  scope?: string;
}

interface RawTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

function parseTokenBody(raw: RawTokenResponse): TokenResponse {
  if (raw.error) {
    throw new Error(
      `OAuth token exchange failed: ${raw.error}${
        raw.error_description ? ` — ${raw.error_description}` : ""
      }`
    );
  }
  if (!raw.access_token) {
    throw new Error("OAuth token exchange returned no access_token");
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: raw.expires_in ? Date.now() + raw.expires_in * 1000 : undefined,
    scope: raw.scope,
  };
}

export async function exchangeCodeForToken(
  descriptor: OAuth2ProviderDescriptor,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  if (!(descriptor.clientId && descriptor.clientSecret)) {
    throw new Error(
      `Provider ${descriptor.id} is missing client credentials (env vars)`
    );
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (descriptor.tokenAuthStyle === "header") {
    const basic = btoa(`${descriptor.clientId}:${descriptor.clientSecret}`);
    headers.Authorization = `Basic ${basic}`;
  } else {
    params.set("client_id", descriptor.clientId);
    params.set("client_secret", descriptor.clientSecret);
  }

  const response = await fetch(descriptor.tokenUrl, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `OAuth token exchange HTTP ${response.status}: ${text.slice(0, 200)}`
    );
  }
  const parsed = JSON.parse(text) as RawTokenResponse;
  return parseTokenBody(parsed);
}

export async function refreshAccessToken(
  descriptor: OAuth2ProviderDescriptor,
  refreshToken: string
): Promise<TokenResponse> {
  if (!(descriptor.clientId && descriptor.clientSecret)) {
    throw new Error(
      `Provider ${descriptor.id} is missing client credentials (env vars)`
    );
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (descriptor.tokenAuthStyle === "header") {
    const basic = btoa(`${descriptor.clientId}:${descriptor.clientSecret}`);
    headers.Authorization = `Basic ${basic}`;
  } else {
    params.set("client_id", descriptor.clientId);
    params.set("client_secret", descriptor.clientSecret);
  }

  const response = await fetch(descriptor.tokenUrl, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `OAuth refresh HTTP ${response.status}: ${text.slice(0, 200)}`
    );
  }
  const parsed = JSON.parse(text) as RawTokenResponse;
  return parseTokenBody(parsed);
}

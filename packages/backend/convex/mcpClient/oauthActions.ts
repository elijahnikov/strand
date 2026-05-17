"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import {
  decryptToken,
  type EncryptedToken,
  encryptToken,
} from "../connections/tokens";
import { getAuthIdentity } from "../utils";
import { findCatalogEntry } from "./catalog";

const STATE_NONCE_BYTES = 24;
const PKCE_VERIFIER_BYTES = 32;
const STATE_TTL_MS = 10 * 60 * 1000;
const NAME_MAX_LEN = 80;

const BASE64_PADDING_RE = /=+$/;
const BASE64_PLUS_RE = /\+/g;
const BASE64_SLASH_RE = /\//g;

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(BASE64_PLUS_RE, "-")
    .replace(BASE64_SLASH_RE, "_")
    .replace(BASE64_PADDING_RE, "");
}

function randomBase64Url(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

interface ProtectedResourceMetadata {
  authorization_servers?: string[];
}

interface AuthorizationServerMetadata {
  authorization_endpoint: string;
  issuer: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  token_endpoint: string;
}

const TRAILING_SLASH_RE = /\/$/;

function trimTrailingSlash(s: string): string {
  return s.replace(TRAILING_SLASH_RE, "");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * RFC 9728 (protected resource metadata) → RFC 8414 (authorization server
 * metadata). Falls back to inferring `/.well-known/oauth-authorization-server`
 * at the MCP origin if the protected-resource doc is missing.
 */
async function discoverAuthServer(
  mcpUrl: string
): Promise<AuthorizationServerMetadata> {
  const origin = new URL(mcpUrl).origin;
  const protectedUrl = `${origin}/.well-known/oauth-protected-resource`;
  const protectedDoc = await fetchJson<ProtectedResourceMetadata>(protectedUrl);
  const authServer = protectedDoc?.authorization_servers?.[0] ?? origin;
  const trimmed = trimTrailingSlash(authServer);

  const candidates = [
    `${trimmed}/.well-known/oauth-authorization-server`,
    `${trimmed}/.well-known/openid-configuration`,
  ];
  for (const candidate of candidates) {
    const meta = await fetchJson<AuthorizationServerMetadata>(candidate);
    if (meta?.authorization_endpoint && meta.token_endpoint) {
      return meta;
    }
  }
  throw new ConvexError(
    `Could not discover OAuth metadata for ${mcpUrl} (looked under ${trimmed}).`
  );
}

interface DynamicClientRegistration {
  client_id: string;
  client_secret?: string;
}

async function dynamicallyRegisterClient(
  registrationEndpoint: string,
  redirectUri: string,
  clientName: string
): Promise<DynamicClientRegistration> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConvexError(
      `Dynamic client registration failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return (await res.json()) as DynamicClientRegistration;
}

const CONVEX_SITE_TRAILING_RE = /\/+$/;

function callbackRedirectUri(): string {
  const base = process.env.CONVEX_SITE_URL;
  if (!base) {
    throw new ConvexError("CONVEX_SITE_URL not set");
  }
  return `${base.replace(CONVEX_SITE_TRAILING_RE, "")}/api/mcp-client/oauth/callback`;
}

export const startOauthConnect = action({
  args: {
    catalogId: v.optional(v.string()),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    returnTo: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Unauthorized");
    }
    const userId = identity.userId as Id<"user">;

    const catalogEntry = args.catalogId
      ? findCatalogEntry(args.catalogId)
      : undefined;
    const url = (args.url ?? catalogEntry?.url ?? "").trim();
    const name = (args.name ?? catalogEntry?.name ?? "").trim();
    if (!url) {
      throw new ConvexError("MCP server URL is required");
    }
    if (!name || name.length > NAME_MAX_LEN) {
      throw new ConvexError(`Server name must be 1–${NAME_MAX_LEN} characters`);
    }

    const meta = await discoverAuthServer(url);
    const redirectUri = callbackRedirectUri();

    if (!meta.registration_endpoint) {
      throw new ConvexError(
        "MCP server's authorization server does not support dynamic client registration"
      );
    }
    const registered = await dynamicallyRegisterClient(
      meta.registration_endpoint,
      redirectUri,
      "Omi"
    );
    const clientId = registered.client_id;
    const encryptedClientSecret: EncryptedToken | undefined =
      registered.client_secret
        ? encryptToken(registered.client_secret)
        : undefined;

    const state = randomBase64Url(STATE_NONCE_BYTES);
    const verifier = randomBase64Url(PKCE_VERIFIER_BYTES);
    const challenge = await pkceChallenge(verifier);
    const scope = catalogEntry?.oauthScope;

    await ctx.runMutation(internal.mcpClient.internals.insertOauthState, {
      state,
      userId,
      catalogId: catalogEntry?.catalogId,
      name,
      url,
      pkceVerifier: verifier,
      oauthClientId: clientId,
      encryptedOauthClientSecret: encryptedClientSecret?.ciphertext,
      tokenKeyVersion: encryptedClientSecret?.keyVersion,
      authorizationEndpoint: meta.authorization_endpoint,
      tokenEndpoint: meta.token_endpoint,
      authorizationServer: meta.issuer,
      scope,
      returnTo: args.returnTo,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const authUrl = new URL(meta.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    if (scope) {
      authUrl.searchParams.set("scope", scope);
    }

    return { authorizationUrl: authUrl.toString() };
  },
});

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

async function exchangeCodeForTokens(
  tokenEndpoint: string,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string | undefined,
  pkceVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: pkceVerifier,
  });
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConvexError(
      `Token exchange failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return (await res.json()) as TokenResponse;
}

async function refreshTokens(
  tokenEndpoint: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string | undefined
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConvexError(
      `Token refresh failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return (await res.json()) as TokenResponse;
}

export const completeOauthCallback = internalAction({
  args: {
    state: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<{ returnTo: string }> => {
    const stored = await ctx.runQuery(
      internal.mcpClient.internals.getOauthState,
      { state: args.state }
    );
    if (!stored) {
      throw new ConvexError("Unknown or expired OAuth state");
    }
    if (stored.expiresAt < Date.now()) {
      await ctx.runMutation(internal.mcpClient.internals.deleteOauthState, {
        id: stored._id,
      });
      throw new ConvexError("OAuth state expired");
    }
    if (!stored.oauthClientId) {
      throw new ConvexError("Missing OAuth client ID for this connection");
    }

    const clientSecret =
      stored.encryptedOauthClientSecret && stored.tokenKeyVersion !== undefined
        ? decryptToken(
            stored.encryptedOauthClientSecret,
            stored.tokenKeyVersion
          )
        : undefined;

    const tokens = await exchangeCodeForTokens(
      stored.tokenEndpoint,
      args.code,
      callbackRedirectUri(),
      stored.oauthClientId,
      clientSecret,
      stored.pkceVerifier
    );

    // PKCE verifier and authorization code are now spent; delete the state
    // row so a stuck server (e.g. tools/list 404) can't leave it orphaned and
    // confuse a retry.
    await ctx.runMutation(internal.mcpClient.internals.deleteOauthState, {
      id: stored._id,
    });

    // Probe initialize + tools/list with the new access token.
    const { McpRpcError, mcpInitialize, mcpToolsList } = await import("./rpc");
    let instructions: string | undefined;
    let sessionId: string | undefined;
    try {
      const initResult = await mcpInitialize({
        url: stored.url,
        bearerToken: tokens.access_token,
      });
      instructions = initResult.instructions?.trim() || undefined;
      sessionId = initResult.sessionId;
    } catch {
      // some servers skip initialize; continue
    }
    let tools: Awaited<ReturnType<typeof mcpToolsList>>;
    try {
      tools = await mcpToolsList({
        url: stored.url,
        bearerToken: tokens.access_token,
        sessionId,
      });
    } catch (err) {
      if (err instanceof McpRpcError) {
        throw new ConvexError(
          `Could not reach ${stored.name} (${err.message}). The MCP endpoint may be wrong, or the server requires SSE transport which Omi does not yet support.`
        );
      }
      throw err;
    }
    const cachedTools = tools.slice(0, 100).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: JSON.stringify(
        t.inputSchema ?? { type: "object", properties: {} }
      ),
    }));
    const enabledTools = cachedTools.map((t) => t.name);

    const access = encryptToken(tokens.access_token);
    const refresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : undefined;
    const accessTokenExpiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    await ctx.runMutation(internal.mcpClient.internals.insertOauthServer, {
      userId: stored.userId,
      catalogId: stored.catalogId,
      name: stored.name,
      url: stored.url,
      encryptedAccessToken: access.ciphertext,
      encryptedRefreshToken: refresh?.ciphertext,
      tokenKeyVersion: access.keyVersion,
      accessTokenExpiresAt,
      oauthClientId: stored.oauthClientId,
      encryptedOauthClientSecret: stored.encryptedOauthClientSecret,
      oauthAuthorizationServer: stored.authorizationServer,
      oauthTokenEndpoint: stored.tokenEndpoint,
      oauthScope: tokens.scope ?? stored.scope,
      cachedTools,
      enabledTools,
      instructions,
    });

    return { returnTo: stored.returnTo };
  },
});

export const refreshAccessToken = internalAction({
  args: { serverId: v.id("mcpServer") },
  handler: async (ctx, args): Promise<void> => {
    const server = await ctx.runQuery(
      internal.mcpClient.internals.getServerForCall,
      { serverId: args.serverId }
    );
    if (
      !server ||
      server.authType !== "oauth2" ||
      !server.encryptedRefreshToken ||
      server.tokenKeyVersion === undefined ||
      !server.oauthTokenEndpoint ||
      !server.oauthClientId
    ) {
      throw new ConvexError("Server has no refresh token");
    }

    const refreshTokenPlain = decryptToken(
      server.encryptedRefreshToken,
      server.tokenKeyVersion
    );
    const clientSecret = server.encryptedOauthClientSecret
      ? decryptToken(server.encryptedOauthClientSecret, server.tokenKeyVersion)
      : undefined;

    const tokens = await refreshTokens(
      server.oauthTokenEndpoint,
      refreshTokenPlain,
      server.oauthClientId,
      clientSecret
    );

    const access = encryptToken(tokens.access_token);
    const newRefresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : undefined;
    const accessTokenExpiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    await ctx.runMutation(internal.mcpClient.internals.patchRefreshedTokens, {
      serverId: args.serverId,
      encryptedAccessToken: access.ciphertext,
      encryptedRefreshToken: newRefresh?.ciphertext,
      tokenKeyVersion: access.keyVersion,
      accessTokenExpiresAt,
    });
  },
});

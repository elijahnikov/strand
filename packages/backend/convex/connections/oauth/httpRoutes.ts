import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import { getOAuth2Provider, isProviderId } from "../providers/registry";
import { verifyState } from "./stateSigner";
import { exchangeCodeForToken } from "./tokenExchange";

const OAUTH_PREFIX = "/api/oauth/";
const TRAILING_SLASHES_RE = /\/+$/;

function convexSiteUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  if (!url) {
    throw new Error("CONVEX_SITE_URL env var is not set");
  }
  return url.replace(TRAILING_SLASHES_RE, "");
}

function redirectUri(provider: string): string {
  return `${convexSiteUrl()}${OAUTH_PREFIX}${provider}/callback`;
}

function parsePath(pathname: string): {
  provider: string;
  action: "start" | "callback";
} | null {
  if (!pathname.startsWith(OAUTH_PREFIX)) {
    return null;
  }
  const rest = pathname.slice(OAUTH_PREFIX.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }
  const [provider, action] = parts;
  if (action !== "start" && action !== "callback") {
    return null;
  }
  return { provider: provider as string, action };
}

function errorRedirect(returnTo: string, reason: string): Response {
  const url = new URL(returnTo);
  url.searchParams.set("connected", "error");
  url.searchParams.set("reason", reason);
  return Response.redirect(url.toString(), 302);
}

export const oauthCallbackHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const parsed = parsePath(url.pathname);
  if (!parsed || parsed.action !== "callback") {
    return new Response("Not found", { status: 404 });
  }
  if (!isProviderId(parsed.provider)) {
    return new Response("Unknown provider", { status: 404 });
  }

  const stateParam = url.searchParams.get("state");
  if (!stateParam) {
    return new Response("Missing state", { status: 400 });
  }
  const state = await verifyState(stateParam);
  if (!state || state.provider !== parsed.provider) {
    return new Response("Invalid state", { status: 400 });
  }

  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return errorRedirect(state.returnTo, errorParam);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return errorRedirect(state.returnTo, "missing_code");
  }

  const descriptor = getOAuth2Provider(parsed.provider);
  try {
    const tokens = await exchangeCodeForToken(
      descriptor,
      code,
      redirectUri(descriptor.id)
    );
    const accountInfo = await descriptor.fetchAccountInfo(tokens.accessToken);
    await ctx.runMutation(internal.connections.internals.insertConnection, {
      userId: state.userId as Id<"user">,
      provider: descriptor.id,
      authType: "oauth2",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      providerAccountId: accountInfo.providerAccountId,
      providerAccountLabel: accountInfo.providerAccountLabel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return errorRedirect(state.returnTo, message);
  }

  return Response.redirect(state.returnTo, 302);
});

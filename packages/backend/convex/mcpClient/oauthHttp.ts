import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

export const oauthCallbackHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (!state) {
    return new Response("Missing state parameter", { status: 400 });
  }

  // Best-effort lookup of the stored OAuth state for the redirect target,
  // so error responses can land back in the user's settings page even when
  // the auth server returned an error and we never get to exchange a code.
  const stored = await ctx.runQuery(
    internal.mcpClient.internals.getOauthState,
    { state }
  );

  if (errorParam) {
    if (stored) {
      const target = new URL(stored.returnTo);
      target.searchParams.set("mcp_connect", "error");
      target.searchParams.set("reason", errorParam);
      return Response.redirect(target.toString(), 302);
    }
    return new Response(`OAuth error: ${errorParam}`, { status: 400 });
  }

  if (!code) {
    return new Response("Missing code parameter", { status: 400 });
  }

  try {
    const { returnTo } = await ctx.runAction(
      internal.mcpClient.oauthActions.completeOauthCallback,
      { state, code }
    );
    const target = new URL(returnTo);
    target.searchParams.set("mcp_connect", "success");
    return Response.redirect(target.toString(), 302);
  } catch (err) {
    const message =
      err instanceof ConvexError && typeof err.data === "string"
        ? err.data
        : err instanceof Error
          ? err.message
          : "OAuth callback failed";
    if (stored) {
      const target = new URL(stored.returnTo);
      target.searchParams.set("mcp_connect", "error");
      target.searchParams.set("reason", message.slice(0, 200));
      return Response.redirect(target.toString(), 302);
    }
    return new Response(message, { status: 500 });
  }
});

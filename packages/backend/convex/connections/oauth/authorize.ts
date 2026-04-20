import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { getAuthIdentity } from "../../utils";
import { getOAuth2Provider, isProviderId } from "../providers/registry";
import { newNonce, signState } from "./stateSigner";

const TRAILING_SLASHES_RE = /\/+$/;

function convexSiteUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  if (!url) {
    throw new ConvexError("CONVEX_SITE_URL env var is not set");
  }
  return url.replace(TRAILING_SLASHES_RE, "");
}

export const getAuthorizeUrl = action({
  args: {
    provider: v.string(),
    returnTo: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    if (!isProviderId(args.provider)) {
      throw new ConvexError(`Unknown provider "${args.provider}"`);
    }
    const descriptor = getOAuth2Provider(args.provider);
    if (!descriptor.clientId) {
      throw new ConvexError(`${descriptor.label} is not configured`);
    }

    const state = await signState({
      userId: identity.userId,
      provider: descriptor.id,
      returnTo: args.returnTo,
      nonce: newNonce(),
    });

    const redirectUri = `${convexSiteUrl()}/api/oauth/${descriptor.id}/callback`;
    const authorizeUrl = new URL(descriptor.authorizeUrl);
    authorizeUrl.searchParams.set("client_id", descriptor.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    if (descriptor.scopes.length > 0) {
      authorizeUrl.searchParams.set("scope", descriptor.scopes.join(" "));
    }
    authorizeUrl.searchParams.set("state", state);
    for (const [key, value] of Object.entries(
      descriptor.authorizeExtraParams ?? {}
    )) {
      authorizeUrl.searchParams.set(key, value);
    }
    return authorizeUrl.toString();
  },
});

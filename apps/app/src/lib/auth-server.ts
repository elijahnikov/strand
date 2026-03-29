import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { env } from "~/env";

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: env.CONVEX_URL,
  convexSiteUrl: env.CONVEX_SITE_URL,
});

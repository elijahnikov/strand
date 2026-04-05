import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL;
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      user: {
        async onCreate(ctx, doc) {
          const userId = await ctx.db.insert("user", {
            email: doc.email,
            username: doc.name ?? doc.email.split("@")[0] ?? "",
            emailVerified: doc.emailVerified,
            onboardedAt: undefined,
            onboardingStep: 0,
            image: doc.image ?? undefined,
          });
          await ctx.runMutation(components.betterAuth.mutations.setUserId, {
            authId: doc._id,
            userId,
          });
          await ctx.runMutation(internal.workspace.mutations.seedWorkspace, {
            userId,
          });
        },
      },
    },
  }
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    baseURL: siteUrl,
    trustedOrigins: [siteUrl ?? "http://localhost:3000"],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      discord: {
        clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
        clientId: process.env.DISCORD_CLIENT_ID as string,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    plugins: [convex({ authConfig, jwks: process.env.JWKS }), username()],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
export const { getAuthUser } = authComponent.clientApi();

export const getLatestJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    const jwks = await auth.api.getLatestJwks();
    return jwks;
  },
});

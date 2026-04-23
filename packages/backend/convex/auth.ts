import { stripe as stripePlugin } from "@better-auth/stripe";
import type { AuthFunctions, GenericCtx } from "@convex-dev/better-auth";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";
import Stripe from "stripe";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import {
  applyActiveSubscription,
  applyCanceledSubscription,
  handleStripeEvent,
} from "./billing/hooks";
import { getPaidPlans } from "./billing/pricing";
import { rateLimiter } from "./rateLimiter";

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
            image: undefined,
          });
          await ctx.runMutation(components.betterAuth.mutations.setUserId, {
            authId: doc._id,
            userId,
          });
          await ctx.runMutation(
            internal.billing.backfill.createPersonalAccountForUser,
            { userId }
          );
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
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        if (!("scheduler" in ctx)) {
          throw new Error(
            "sendVerificationEmail requires a mutation or action context"
          );
        }
        await rateLimiter.limit(ctx, "emailVerificationSend", {
          key: user.email,
          throws: true,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.email.sendVerificationEmail.send,
          {
            to: user.email,
            url,
            name: user.name,
          }
        );
      },
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
    plugins: [
      convex({ authConfig, jwks: process.env.JWKS }),
      username(),
      ...(process.env.STRIPE_SECRET_KEY ? [buildStripePlugin(ctx)] : []),
    ],
  } satisfies BetterAuthOptions;
};

/**
 * Stripe plugin wiring. The plugin owns:
 *   - Stripe customer creation on signup
 *   - Checkout + Customer Portal session endpoints (via authClient.subscription)
 *   - Webhook signature verification + event dispatch
 *
 * We mirror subscription state onto our `billingAccount` rows via the
 * lifecycle hooks, which close over `ctx` and call into `internal.billing.*`.
 */
function buildStripePlugin(ctx: GenericCtx<DataModel>) {
  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    // Pin an API version so Stripe behavior is deterministic across deploys.
    apiVersion: "2026-03-25.dahlia",
  });
  return stripePlugin({
    stripeClient,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: () =>
        getPaidPlans().map((p) => ({
          name: p.name,
          priceId: p.monthlyPriceId,
          annualDiscountPriceId: p.yearlyPriceId,
        })),
      onSubscriptionComplete: async ({ subscription }) => {
        await applyActiveSubscription(ctx as ActionCtx, subscription, {
          topUp: true,
        });
      },
      onSubscriptionUpdate: async ({ subscription }) => {
        await applyActiveSubscription(ctx as ActionCtx, subscription, {
          topUp: false,
        });
      },
      onSubscriptionCancel: async ({ subscription }) => {
        await applyCanceledSubscription(ctx as ActionCtx, subscription);
      },
      onSubscriptionDeleted: async ({ subscription }) => {
        await applyCanceledSubscription(ctx as ActionCtx, subscription);
      },
    },
    onEvent: async (event) => {
      await handleStripeEvent(ctx as ActionCtx, event);
    },
  });
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const getLatestJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    const jwks = await auth.api.getLatestJwks();
    return jwks;
  },
});

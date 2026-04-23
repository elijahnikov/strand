import { convexQuery, useConvexAction } from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { useEffect, useRef } from "react";
import { CreditsCard } from "./credits-card";
import { UsageList } from "./usage-list";

type Plan = "free" | "basic" | "pro";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

const PLAN_VARIANT: Record<Plan, "secondary" | "info" | "default"> = {
  free: "secondary",
  basic: "info",
  pro: "default",
};

function formatDate(ts: number | undefined): string {
  if (!ts) {
    return "—";
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingTab() {
  const { data: state, isLoading } = useQuery(
    convexQuery(api.billing.queries.getMyBillingState, {})
  );

  usePostCheckoutSync();

  if (isLoading) {
    return (
      <div className="w-full">
        <Text className="text-ui-fg-subtle" size="small">
          Loading…
        </Text>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="w-full">
        <Heading>Billing</Heading>
        <Text className="mt-2 text-ui-fg-subtle" size="small">
          Your billing account hasn't been set up yet. Refresh the page in a
          moment.
        </Text>
      </div>
    );
  }

  const plan = state.plan as Plan;

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <Heading>Billing</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Your plan and credit usage. Credits power AI features — chat, search,
          and enrichment.
        </Text>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Text className="font-medium" size="small">
              Current plan
            </Text>
            <Badge variant={PLAN_VARIANT[plan]}>{PLAN_LABEL[plan]}</Badge>
          </div>
          {state.hasActiveSubscription ? (
            <ManagePlanButton />
          ) : (
            <UpgradeButtons currentPlan={plan} />
          )}
        </div>
        {state.hasActiveSubscription && state.stripeCurrentPeriodEnd ? (
          <Text className="text-ui-fg-subtle" size="xsmall">
            Billed {state.billingCadence ?? "monthly"} · Next renewal{" "}
            {formatDate(state.stripeCurrentPeriodEnd)}
          </Text>
        ) : null}
        <ResyncButton />
      </section>

      <CreditsCard
        creditBalance={state.creditBalance}
        creditResetAt={state.creditResetAt}
        plan={plan}
      />

      <UsageList />
    </div>
  );
}

function ManagePlanButton() {
  return (
    <Button
      onClick={async () => {
        const { data, error } = await authClient.subscription.billingPortal();
        if (error || !data) {
          return;
        }
        window.location.href = data.url;
      }}
      variant="secondary"
    >
      Manage
    </Button>
  );
}

function UpgradeButtons({ currentPlan }: { currentPlan: Plan }) {
  return (
    <div className="flex flex-wrap gap-2">
      {currentPlan === "free" ? (
        <>
          <Button
            onClick={() => upgradeTo("basic", "monthly")}
            size="small"
            variant="secondary"
          >
            Basic · Monthly
          </Button>
          <Button
            onClick={() => upgradeTo("basic", "yearly")}
            size="small"
            variant="secondary"
          >
            Basic · Yearly
          </Button>
        </>
      ) : null}
      {currentPlan === "pro" ? null : (
        <>
          <Button onClick={() => upgradeTo("pro", "monthly")} size="small">
            Pro · Monthly
          </Button>
          <Button onClick={() => upgradeTo("pro", "yearly")} size="small">
            Pro · Yearly
          </Button>
        </>
      )}
    </div>
  );
}

type ResyncResult =
  | { status: "no-auth-user" }
  | { status: "no-active-subscription" }
  | { status: "subscription-missing-fields" }
  | { status: "unknown-price-id"; priceId: string }
  | {
      status: "resynced";
      plan: "free" | "basic" | "pro";
      cadence: "monthly" | "yearly";
    };

function ResyncButton() {
  const queryClient = useQueryClient();
  const resyncAction = useConvexAction(api.billing.repair.resyncMySubscription);
  const { mutate: resync, isPending } = useMutation({
    mutationFn: (args: Record<string, never>) =>
      resyncAction(args) as Promise<ResyncResult>,
    onSuccess: (result) => {
      if (result.status === "resynced") {
        toastManager.add({
          type: "success",
          title: "Subscription synced",
          description: `Your ${result.plan} (${result.cadence}) plan is now active.`,
        });
      } else if (result.status === "no-active-subscription") {
        toastManager.add({
          type: "info",
          title: "No active subscription found",
          description: "Nothing to sync. Start a checkout instead.",
        });
      } else {
        toastManager.add({
          type: "error",
          title: "Could not sync subscription",
          description: result.status,
        });
      }
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.billing.queries.getMyBillingState, {})
          .queryKey,
      });
    },
    onError: (err) => {
      const message =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Unknown error";
      toastManager.add({
        type: "error",
        title: "Resync failed",
        description: message,
      });
    },
  });
  return (
    <div className="flex items-center justify-between border-t pt-3">
      <Text className="text-ui-fg-subtle" size="xsmall">
        Already paid but not reflected here? Resync from Stripe.
      </Text>
      <Button
        disabled={isPending}
        onClick={() => resync({})}
        size="small"
        variant="secondary"
      >
        {isPending ? "Syncing…" : "Resync"}
      </Button>
    </div>
  );
}

/**
 * After Stripe checkout redirects back with `?checkout=success`, the webhook
 * that updates `billingAccount` may still be in flight. Refetch the billing
 * query on a short interval for ~20s so the UI catches up without the user
 * needing to reload or hit Resync.
 */
function usePostCheckoutSync() {
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") {
      return;
    }
    started.current = true;

    const queryKey = convexQuery(api.billing.queries.getMyBillingState, {})
      .queryKey;
    const start = Date.now();
    const interval = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey });
      if (Date.now() - start > 20_000) {
        window.clearInterval(interval);
      }
    }, 1500);

    params.delete("checkout");
    const newSearch = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`
    );

    return () => window.clearInterval(interval);
  }, [queryClient]);
}

async function upgradeTo(plan: "basic" | "pro", cadence: "monthly" | "yearly") {
  const { data, error } = await authClient.subscription.upgrade({
    plan,
    annual: cadence === "yearly",
    successUrl: `${window.location.origin}/account?tab=billing&checkout=success`,
    cancelUrl: `${window.location.origin}/account?tab=billing&checkout=cancel`,
  });
  if (error) {
    // biome-ignore lint/suspicious/noConsole: diagnostic for checkout flow
    console.error("subscription.upgrade failed", error);
    return;
  }
  if (!data?.url) {
    return;
  }
  window.location.href = data.url;
}

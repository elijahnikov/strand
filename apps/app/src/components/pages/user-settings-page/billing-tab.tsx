import { convexQuery, useConvexAction } from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { LoadingButton } from "@omi/ui/loading-button";
import { Tabs, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Plan = "free" | "basic" | "pro";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

const PLAN_ORDER: Plan[] = ["free", "basic", "pro"];

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  basic: 1,
  pro: 2,
};

interface PlanInfo {
  features: string[];
  name: Plan;
  pricing: {
    monthly: string;
    yearly: string;
  };
  tagline: string;
}

const PLANS: Record<Plan, PlanInfo> = {
  free: {
    name: "free",
    tagline: "Try the product without a card.",
    pricing: { monthly: "$0", yearly: "$0" },
    features: [
      "500 AI actions / month",
      "100 MB file storage",
      "Up to 3 workspaces",
      "Auto-summaries, tagging, semantic search, and chat — within your credit budget",
      "All imports and connections (Notion, Raindrop, Readwise, Fabric, MyMind, Evernote, bookmarks)",
      "Bring your own API key (skips credit charges for chat and search)",
    ],
  },
  basic: {
    name: "basic",
    tagline: "For active personal libraries.",
    pricing: { monthly: "$5 / mo", yearly: "$50 / yr" },
    features: [
      "3,000 AI actions / month",
      "5 GB file storage",
      "Unlimited workspaces",
      "Home-page AI insights: concept clusters, recent connections, forgotten gems",
      "Everything in Free",
    ],
  },
  pro: {
    name: "pro",
    tagline: "For heavy users.",
    pricing: { monthly: "$12 / mo", yearly: "$120 / yr" },
    features: [
      "10,000 AI actions / month",
      "25 GB file storage",
      "Unlimited workspaces",
      "Everything in Basic",
    ],
  },
};

type SubscriptionStatus = "past_due" | "unpaid" | "canceled";

const STATUS_MESSAGE: Record<SubscriptionStatus, string> = {
  past_due:
    "Your last payment failed. Update your card in the billing portal to keep your plan.",
  unpaid:
    "Your subscription is unpaid. Update your payment method to restore full access.",
  canceled:
    "Your subscription has ended. Start a new one to restore paid features.",
};

function isWarningStatus(value: unknown): value is SubscriptionStatus {
  return value === "past_due" || value === "unpaid" || value === "canceled";
}

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
      <Text className="text-ui-fg-subtle" size="small">
        Loading…
      </Text>
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
    <div className="flex w-full flex-col gap-6">
      <div>
        <Heading>Billing</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Manage your plan, payment method, and invoices.
        </Text>
      </div>

      {isWarningStatus(state.subscriptionStatus) ? (
        <SubscriptionStatusBanner status={state.subscriptionStatus} />
      ) : null}

      <PlanSection
        billingCadence={state.billingCadence}
        hasActiveSubscription={state.hasActiveSubscription}
        plan={plan}
        stripeCurrentPeriodEnd={state.stripeCurrentPeriodEnd ?? undefined}
      />

      <PlansSection currentPlan={plan} />

      {plan === "free" ? null : <CancellationSection />}
    </div>
  );
}

function CancellationSection() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border-[0.5px] border-destructive/40 bg-destructive/5 p-4">
      <div>
        <Heading level="h2">Cancellation</Heading>
        <Text className="text-ui-fg-subtle" size="xsmall">
          Cancel your plan from the Stripe billing portal. You'll keep access
          until the end of your current billing period.
        </Text>
      </div>
      <div>
        <PortalButton variant="secondary">Cancel plan</PortalButton>
      </div>
    </section>
  );
}

function PlanSection({
  plan,
  hasActiveSubscription,
  billingCadence,
  stripeCurrentPeriodEnd,
}: {
  plan: Plan;
  hasActiveSubscription: boolean;
  billingCadence: string | null | undefined;
  stripeCurrentPeriodEnd: number | undefined;
}) {
  const isPaid = plan !== "free";

  return (
    <section className="flex flex-col gap-3 rounded-lg py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heading level="h2">Current plan</Heading>
          <Badge className="px-2" variant="secondary">
            {PLAN_LABEL[plan]}
          </Badge>
        </div>
      </div>
      {hasActiveSubscription && stripeCurrentPeriodEnd ? (
        <Text className="text-ui-fg-subtle" size="xsmall">
          Billed{" "}
          <span className="text-ui-fg-base">{billingCadence ?? "monthly"}</span>{" "}
          · Next renewal{" "}
          <Badge size="sm" variant="secondary">
            {formatDate(stripeCurrentPeriodEnd)}
          </Badge>
        </Text>
      ) : null}
      {isPaid ? (
        <div className="flex flex-wrap gap-2">
          <PortalButton variant="omi">Manage subscription</PortalButton>
          <PortalButton variant="secondary">View invoices</PortalButton>
        </div>
      ) : (
        <Text className="text-ui-fg-muted" size="xsmall">
          You're on the Free plan. Upgrade below to unlock more AI actions and
          storage.
        </Text>
      )}
      <ResyncButton />
    </section>
  );
}

function PortalButton({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "omi" | "secondary";
}) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.subscription.billingPortal();
      if (error || !data) {
        toastManager.add({
          type: "error",
          title: "Could not open billing portal",
          description: error?.message ?? "Please try again.",
        });
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };
  return (
    <LoadingButton
      loading={loading}
      onClick={handleClick}
      size="small"
      variant={variant}
    >
      {children}
    </LoadingButton>
  );
}

function PlansSection({ currentPlan }: { currentPlan: Plan }) {
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="flex flex-col gap-4 rounded-lg py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h2">Plans</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Compare what's included and upgrade when you outgrow your current
            plan.
          </Text>
        </div>
        <Tabs
          onValueChange={(next) => setCadence(next as "monthly" | "yearly")}
          orientation="horizontal"
          value={cadence}
        >
          <TabsList>
            <TabsTrigger value="monthly">
              <Text className="font-medium" size="small">
                Monthly
              </Text>
            </TabsTrigger>
            <TabsTrigger value="yearly">
              <Text className="font-medium" size="small">
                Yearly
              </Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PLAN_ORDER.map((p) => (
          <PlanCard
            cadence={cadence}
            currentPlan={currentPlan}
            key={p}
            plan={p}
          />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  currentPlan,
  cadence,
}: {
  plan: Plan;
  currentPlan: Plan;
  cadence: "monthly" | "yearly";
}) {
  const info = PLANS[plan];
  const isCurrent = plan === currentPlan;
  const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan];

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border-[0.5px] p-4 ${
        isCurrent ? "bg-ui-bg-subtle shadow-borders-focus" : "bg-ui-bg-subtle"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Heading level="h3">{PLAN_LABEL[plan]}</Heading>
      </div>
      <div>
        <Text className="font-semibold" size="large">
          {info.pricing[cadence]}
        </Text>
        <Text className="text-ui-fg-subtle" size="xsmall">
          {info.tagline}
        </Text>
      </div>
      <ul className="flex flex-col gap-2">
        {info.features.map((feature) => (
          <li className="flex items-start gap-2" key={feature}>
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-ui-fg-muted" />
            <Text className="text-ui-fg-subtle" size="xsmall">
              {feature}
            </Text>
          </li>
        ))}
      </ul>
      <PlanCardCta
        cadence={cadence}
        isCurrent={isCurrent}
        isUpgrade={isUpgrade}
        plan={plan}
      />
    </div>
  );
}

function PlanCardCta({
  plan,
  isCurrent,
  isUpgrade,
  cadence,
}: {
  plan: Plan;
  isCurrent: boolean;
  isUpgrade: boolean;
  cadence: "monthly" | "yearly";
}) {
  if (isCurrent) {
    return (
      <Text className="mt-auto font-medium" size="small">
        Current plan
      </Text>
    );
  }
  if (isUpgrade && plan !== "free") {
    return (
      <Button
        className="mt-auto"
        onClick={() => upgradeTo(plan as "basic" | "pro", cadence)}
        size="small"
        variant={plan === "pro" ? "omi" : "secondary"}
      >
        Upgrade to {PLAN_LABEL[plan]}
      </Button>
    );
  }
  return null;
}

function SubscriptionStatusBanner({ status }: { status: SubscriptionStatus }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-yellow-700/50 dark:bg-warning/16">
      <div className="flex flex-col gap-1">
        <Text className="font-medium text-warning-foreground" size="small">
          {status === "canceled"
            ? "Subscription ended"
            : "Action required on your subscription"}
        </Text>
        <Text className="text-warning-foreground" size="xsmall">
          {STATUS_MESSAGE[status]}
        </Text>
      </div>
      <PortalButton variant="omi">Open billing portal</PortalButton>
    </section>
  );
}

async function upgradeTo(plan: "basic" | "pro", cadence: "monthly" | "yearly") {
  const { data, error } = await authClient.subscription.upgrade({
    plan,
    annual: cadence === "yearly",
    successUrl: `${window.location.origin}/account?tab=billing&checkout=success`,
    cancelUrl: `${window.location.origin}/account?tab=billing&checkout=cancel`,
  });
  if (error) {
    return;
  }
  if (!data?.url) {
    return;
  }
  window.location.href = data.url;
}

type ResyncResult =
  | { status: "no-auth-user" }
  | { status: "no-active-subscription" }
  | { status: "subscription-missing-fields" }
  | { status: "unknown-price-id"; priceId: string }
  | {
      status: "resynced";
      plan: Plan;
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
    <Text className="text-ui-fg-muted" size="xsmall">
      Already paid but not reflected here?{" "}
      <button
        className="underline underline-offset-2 hover:text-ui-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={() => resync({})}
        type="button"
      >
        {isPending ? "Syncing…" : "Resync from Stripe"}
      </button>
    </Text>
  );
}

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

    const queryKey = convexQuery(
      api.billing.queries.getMyBillingState,
      {}
    ).queryKey;
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

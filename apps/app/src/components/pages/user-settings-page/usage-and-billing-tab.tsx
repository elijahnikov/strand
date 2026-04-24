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

type Plan = "free" | "basic" | "pro";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

const PLAN_ALLOTMENT: Record<Plan, number> = {
  free: 1500,
  basic: 3000,
  pro: 10_000,
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

const REASON_LABEL = {
  chat: "Chat",
  search: "Search",
  enrich: "Enrich",
  "memory-extract": "Memory",
  other: "Other",
} as const;

type ReasonKey = keyof typeof REASON_LABEL;

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

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

function formatShortDate(ts: number | undefined): string {
  if (!ts) {
    return "—";
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(1)} GB`;
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  if (bytes >= KB) {
    return `${(bytes / KB).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function UsageAndBillingTab() {
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
        <Heading>Usage & Billing</Heading>
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
        <Heading>Usage & Billing</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Your plan and AI actions. AI actions power chat, search, and
          enrichment.
        </Text>
      </div>

      {isWarningStatus(state.subscriptionStatus) ? (
        <SubscriptionStatusBanner status={state.subscriptionStatus} />
      ) : null}

      <PlanSection
        billingCadence={state.billingCadence}
        hasActiveSubscription={state.hasActiveSubscription}
        plan={plan}
        stripeCurrentPeriodEnd={state.stripeCurrentPeriodEnd}
      />

      <CreditsCard
        creditBalance={state.creditBalance}
        creditResetAt={state.creditResetAt}
        plan={plan}
      />

      <StorageCard
        storageBytesAllotment={state.storageBytesAllotment}
        storageBytesUsed={state.storageBytesUsed}
      />

      <UsageList />
    </div>
  );
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
      <ManagePlanButton />
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
  stripeCurrentPeriodEnd: number | null | undefined;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heading level="h2">Current plan</Heading>
          <Badge className="px-2" variant="secondary">
            {PLAN_LABEL[plan]}
          </Badge>
        </div>
        {hasActiveSubscription ? (
          <ManagePlanButton />
        ) : (
          <UpgradeButtons currentPlan={plan} />
        )}
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
      <ResyncButton />
    </section>
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

async function upgradeTo(plan: "basic" | "pro", cadence: "monthly" | "yearly") {
  const { data, error } = await authClient.subscription.upgrade({
    plan,
    annual: cadence === "yearly",
    successUrl: `${window.location.origin}/account?tab=billing&checkout=success`,
    cancelUrl: `${window.location.origin}/account?tab=billing&checkout=cancel`,
  });
  if (error) {
    console.error("subscription.upgrade failed", error);
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

function CreditsCard({
  creditBalance,
  creditResetAt,
  plan,
}: {
  creditBalance: number;
  creditResetAt: number | undefined;
  plan: Plan;
}) {
  const allotment = PLAN_ALLOTMENT[plan];
  const aboveCap = creditBalance > allotment;
  const used = Math.max(0, allotment - creditBalance);
  const pct = aboveCap
    ? 100
    : allotment > 0
      ? Math.min(100, (used / allotment) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
      <div className="flex items-baseline justify-between">
        <Heading className="font-medium" level="h2">
          AI actions
        </Heading>
        <Text className="flex gap-x-1" size="small">
          <Badge variant="mono">{creditBalance.toLocaleString()}</Badge>/
          <Badge variant="mono">
            {(aboveCap ? creditBalance : allotment).toLocaleString()}
          </Badge>
        </Text>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
        <div
          className="h-full rounded-full bg-ui-fg-base transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Text className="text-ui-fg-muted" size="xsmall">
        {aboveCap
          ? `Carried over from previous plan. Drops to ${allotment.toLocaleString()} on ${formatShortDate(creditResetAt)}.`
          : `Resets ${formatShortDate(creditResetAt)}`}
      </Text>
    </section>
  );
}

function StorageCard({
  storageBytesUsed,
  storageBytesAllotment,
}: {
  storageBytesUsed: number;
  storageBytesAllotment: number;
}) {
  const pct =
    storageBytesAllotment > 0
      ? Math.min(100, (storageBytesUsed / storageBytesAllotment) * 100)
      : 0;
  const nearFull = pct >= 90;

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
      <div className="flex items-baseline justify-between">
        <Heading className="font-medium" level="h2">
          File storage
        </Heading>
        <Text className="flex gap-x-1" size="small">
          <Badge variant="mono">{formatBytes(storageBytesUsed)}</Badge>/
          <Badge variant="mono">{formatBytes(storageBytesAllotment)}</Badge>
        </Text>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
        <div
          className={`h-full rounded-full transition-all ${
            nearFull ? "bg-warning" : "bg-ui-fg-base"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Text className="text-ui-fg-muted" size="xsmall">
        Used across all files you've uploaded. Upgrade your plan to raise the
        cap.
      </Text>
    </section>
  );
}

function UsageList() {
  const { data, isLoading } = useQuery(
    convexQuery(api.billing.queries.getMyUsageByWorkspace, {})
  );

  if (isLoading) {
    return null;
  }

  const rows = data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
      <Heading level="h2">Usage this period</Heading>
      {rows.length === 0 ? (
        <Text className="text-ui-fg-muted" size="xsmall">
          No AI actions used yet this period.
        </Text>
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li className="flex flex-col gap-1 py-2" key={row.workspaceId}>
              <div className="flex items-center justify-between">
                <Text size="base">{row.name}</Text>
                <Text className="text-ui-fg-subtle" size="small">
                  {row.credits.toLocaleString()} actions
                </Text>
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(REASON_LABEL) as ReasonKey[])
                  .filter((k) => row.byReason[k] > 0)
                  .map((k) => (
                    <Badge className="text-[12px]" key={k} variant="mono">
                      {REASON_LABEL[k]} · {row.byReason[k].toLocaleString()}
                    </Badge>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

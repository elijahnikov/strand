import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { Badge } from "@omi/ui/badge";
import { Heading } from "@omi/ui/heading";
import { Skeleton } from "@omi/ui/skeleton";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";
import { TabSkeleton } from "./tab-skeleton";

type Plan = "free" | "basic" | "pro";

const PLAN_ALLOTMENT: Record<Plan, number> = {
  free: 500,
  basic: 3000,
  pro: 10_000,
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

export function UsageTab() {
  const { data: state, isLoading } = useQuery(
    convexQuery(api.billing.queries.getMyBillingState, {})
  );

  if (isLoading) {
    return <TabSkeleton />;
  }

  if (!state) {
    return (
      <div className="w-full">
        <Heading>Usage</Heading>
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
        <Heading>Usage</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          AI actions power chat, search, and enrichment across your workspaces.
        </Text>
      </div>

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
  const used = Math.max(0, allotment - creditBalance);
  const pct = allotment > 0 ? Math.min(100, (used / allotment) * 100) : 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg py-4">
      <div className="flex items-baseline justify-between">
        <Heading className="font-medium" level="h2">
          AI actions
        </Heading>
        <Text className="flex gap-x-1" size="small">
          <Badge variant="mono">{creditBalance.toLocaleString()}</Badge>/
          <Badge variant="mono">{allotment.toLocaleString()}</Badge>
        </Text>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Text className="text-ui-fg-muted" size="xsmall">
        Resets {formatShortDate(creditResetAt)}
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
    <section className="flex flex-col gap-3 rounded-lg py-4">
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
            nearFull ? "bg-warning" : "bg-blue-500"
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
    return (
      <section className="flex flex-col gap-3 rounded-lg py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </section>
    );
  }

  const rows = data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg py-4">
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

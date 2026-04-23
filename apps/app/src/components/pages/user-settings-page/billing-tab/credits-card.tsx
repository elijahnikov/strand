import { Badge } from "@omi/ui/badge";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";

type Plan = "free" | "basic" | "pro";

const PLAN_ALLOTMENT: Record<Plan, number> = {
  free: 500,
  basic: 3000,
  pro: 10_000,
};

function formatDate(ts: number | undefined): string {
  if (!ts) {
    return "—";
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface CreditsCardProps {
  creditBalance: number;
  creditResetAt: number | undefined;
  plan: Plan;
}

export function CreditsCard({
  creditBalance,
  creditResetAt,
  plan,
}: CreditsCardProps) {
  const allotment = PLAN_ALLOTMENT[plan];

  const aboveCap = creditBalance > allotment;
  const used = Math.max(0, allotment - creditBalance);
  const pct = aboveCap
    ? 100
    : allotment > 0
      ? Math.min(100, (used / allotment) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg p-4">
      <div className="flex items-baseline justify-between">
        <Heading className="font-medium" level="h2">
          Credits
        </Heading>
        <Text className="flex gap-x-1" size="small">
          <Badge variant={"mono"}>{creditBalance.toLocaleString()}</Badge>/
          <Badge variant={"mono"}>
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
          ? `Carried over from previous plan. Drops to ${allotment.toLocaleString()} on ${formatDate(creditResetAt)}.`
          : `Resets ${formatDate(creditResetAt)}`}
      </Text>
    </section>
  );
}

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
  // When balance > allotment (post-downgrade carryover) we show the bar as
  // full and switch the denominator to the balance itself so the card reads
  // sensibly. A note below explains the next reset will drop to the tier cap.
  const aboveCap = creditBalance > allotment;
  const used = Math.max(0, allotment - creditBalance);
  const pct = aboveCap
    ? 100
    : allotment > 0
      ? Math.min(100, (used / allotment) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between">
        <Text className="font-medium" size="small">
          Credits
        </Text>
        <Text size="small">
          <span className="font-medium">{creditBalance.toLocaleString()}</span>
          <span className="text-ui-fg-subtle">
            {" "}
            / {(aboveCap ? creditBalance : allotment).toLocaleString()}
          </span>
        </Text>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
        <div
          className="h-full rounded-full bg-ui-fg-base transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Text className="text-ui-fg-subtle" size="xsmall">
        {aboveCap
          ? `Carried over from previous plan. Drops to ${allotment.toLocaleString()} on ${formatDate(creditResetAt)}.`
          : `Resets ${formatDate(creditResetAt)}`}
      </Text>
    </section>
  );
}

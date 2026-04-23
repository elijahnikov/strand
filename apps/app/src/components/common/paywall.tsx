import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Plan = "free" | "basic" | "pro";
type Feature = "premium-model" | "large-upload" | "advanced-search";

const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  "premium-model": "pro",
  "large-upload": "basic",
  "advanced-search": "basic",
};

const FEATURE_COPY: Record<Feature, string> = {
  "premium-model": "Upgrade to Pro to use premium models.",
  "large-upload": "Upgrade to Basic to unlock larger uploads.",
  "advanced-search": "Upgrade to Basic for advanced search.",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  basic: 1,
  pro: 2,
};

interface PlanGateProps {
  children: ReactNode;
  feature: Feature;
  workspaceId: Id<"workspace">;
}

export function PlanGate({ children, feature, workspaceId }: PlanGateProps) {
  const { data } = useQuery(
    convexQuery(api.billing.queries.getActingPlan, { workspaceId })
  );

  if (!data) {
    return null;
  }

  const required = FEATURE_MIN_PLAN[feature];
  const allowed = PLAN_RANK[data.plan as Plan] >= PLAN_RANK[required];

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-3">
      <Text className="text-ui-fg-subtle" size="small">
        {FEATURE_COPY[feature]}
      </Text>
      <Button
        onClick={() => {
          window.location.href = "/account";
        }}
        size="small"
      >
        View plans
      </Button>
    </div>
  );
}

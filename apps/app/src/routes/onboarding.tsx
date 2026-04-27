import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingPageComponent } from "~/components/pages/onboarding-page";

interface OnboardingSearch {
  connections?: string;
  step?: number;
}

export const Route = createFileRoute("/onboarding")({
  component: OnboardingRoute,
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => {
    const rawStep = search.step;
    const step =
      typeof rawStep === "number" && rawStep >= 1 && rawStep <= 5
        ? rawStep
        : undefined;
    const connections =
      typeof search.connections === "string" ? search.connections : undefined;
    return { step, connections };
  },
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
    const { user } = await context.queryClient.ensureQueryData(
      convexQuery(api.user.queries.currentUser, {})
    );
    if (user && user.onboardedAt !== undefined) {
      const workspaces = await context.queryClient.ensureQueryData(
        convexQuery(api.workspace.queries.listByUser, {})
      );
      const target = workspaces[0];
      if (target) {
        throw redirect({
          to: "/workspace/$workspaceId",
          params: { workspaceId: target._id },
        });
      }
    }
  },
});

function OnboardingRoute() {
  const { step } = Route.useSearch();
  return <OnboardingPageComponent step={step ?? 1} />;
}

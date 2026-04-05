import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { GlobalLayout } from "~/components/common/global-workspace-layout";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayoutComponent,
  pendingComponent: PendingComponent,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.user.queries.currentUser, {})
    );
  },
});

function PendingComponent() {
  return (
    <Authenticated>
      <GlobalLayout>
        <div />
      </GlobalLayout>
    </Authenticated>
  );
}

function WorkspaceLayoutComponent() {
  return (
    <Authenticated>
      <GlobalLayout>
        <Outlet />
      </GlobalLayout>
    </Authenticated>
  );
}

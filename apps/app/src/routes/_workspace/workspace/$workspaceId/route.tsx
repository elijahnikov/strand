import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { isUnauthenticatedError } from "@omi/backend/shared.js";
import {
  createFileRoute,
  isRedirect,
  Outlet,
  redirect,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/workspace/$workspaceId")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        convexQuery(api.workspace.queries.getById, {
          workspaceId: params.workspaceId as Id<"workspace">,
        })
      );
    } catch (error) {
      if (isRedirect(error)) {
        throw error;
      }
      if (isUnauthenticatedError(error)) {
        throw redirect({ to: "/login" });
      }
      throw redirect({ to: "/404" });
    }
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import ResourcePageComponent from "~/components/pages/resource-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/resource/$resourceId"
)({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.resource.queries.get, {
        workspaceId: params.workspaceId as Id<"workspace">,
        resourceId: params.resourceId as Id<"resource">,
      })
    );
  },
  component: ResourcePageComponent,
});

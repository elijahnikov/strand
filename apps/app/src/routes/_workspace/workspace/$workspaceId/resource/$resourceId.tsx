import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

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
  component: ResourcePage,
});

function ResourcePage() {
  const { workspaceId, resourceId } = Route.useParams();

  const { data: resource } = useSuspenseQuery(
    convexQuery(api.resource.queries.get, {
      workspaceId: workspaceId as Id<"workspace">,
      resourceId: resourceId as Id<"resource">,
    })
  );

  if (!resource) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-ui-fg-muted">Resource not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-2/3 p-6">
      <h1 className="font-semibold text-lg">{resource.title}</h1>
    </div>
  );
}

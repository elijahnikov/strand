import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Skeleton } from "@strand/ui/skeleton";
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
  pendingComponent: ResourcePageSkeleton,
  component: ResourcePageComponent,
});

function ResourcePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-4 h-5 w-96" />
      <div className="mt-8 flex flex-col gap-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton className="h-16 w-full" key={i} />
        ))}
      </div>
    </div>
  );
}

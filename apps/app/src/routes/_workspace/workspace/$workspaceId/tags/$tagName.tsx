import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Skeleton } from "@strand/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { TagPageComponent } from "~/components/pages/tag-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/tags/$tagName"
)({
  loader: async ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    const tagName = params.tagName;
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.getTag, { workspaceId, tagName })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.listByTag, { workspaceId, tagName })
      ),
    ]);
  },
  pendingComponent: TagPageSkeleton,
  component: TagPageComponent,
});

function TagPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Skeleton className="h-8 w-48" />
      <div className="mt-12 flex flex-col gap-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton className="h-11 w-full" key={i} />
        ))}
      </div>
    </div>
  );
}

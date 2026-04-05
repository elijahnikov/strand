import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Skeleton } from "@strand/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { CollectionPageComponent } from "~/components/pages/collection-page";
import { ResourceListSkeleton } from "~/components/pages/library-page/resource-list";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library/collection/$collectionId"
)({
  loader: async ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    const collectionId = params.collectionId as Id<"collection">;
    await context.queryClient.ensureQueryData(
      convexQuery(api.collection.queries.get, { workspaceId, collectionId })
    );
    context.queryClient.prefetchQuery(
      convexQuery(api.collection.queries.listChildren, {
        workspaceId,
        parentId: collectionId,
      })
    );
  },
  pendingComponent: CollectionPageSkeleton,
  component: CollectionPage,
});

function CollectionPage() {
  const { workspaceId, collectionId } = Route.useParams();

  return (
    <CollectionPageComponent
      collectionId={collectionId as Id<"collection">}
      workspaceId={workspaceId as Id<"workspace">}
    />
  );
}

function CollectionPageSkeleton() {
  return (
    <div className="mx-auto w-2/3 px-6 pt-14 pb-4">
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
      </div>
      <ResourceListSkeleton count={10} />
    </div>
  );
}

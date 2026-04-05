import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { CollectionPageComponent } from "~/components/pages/collection-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library/collection/$collectionId"
)({
  loader: ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    const collectionId = params.collectionId as Id<"collection">;
    context.queryClient.prefetchQuery(
      convexQuery(api.collection.queries.get, { workspaceId, collectionId })
    );
    context.queryClient.prefetchQuery(
      convexQuery(api.collection.queries.listChildren, {
        workspaceId,
        parentId: collectionId,
      })
    );
  },
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

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { LibraryPageComponent } from "~/components/pages/library-page";

const PAGE_SIZE = 20;

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/library/"
)({
  component: LibraryPage,
  loader: async ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.list, {
          workspaceId,
          paginationOpts: { numItems: PAGE_SIZE, cursor: null },
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.collection.queries.listChildren, {
          workspaceId,
          parentId: undefined,
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.listPinned, { workspaceId })
      ),
    ]);
  },
});

function LibraryPage() {
  const { workspaceId } = Route.useParams();

  return <LibraryPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

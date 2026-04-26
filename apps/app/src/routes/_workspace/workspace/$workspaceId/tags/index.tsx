import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Skeleton } from "@omi/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { PageContent } from "~/components/common/page-content";
import { TagsPageComponent } from "~/components/pages/tags-page";

const PAGE_SIZE = 30;

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/tags/"
)({
  pendingComponent: TagsPageSkeleton,
  component: TagsPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      convexQuery(api.resource.queries.listWorkspaceTags, {
        workspaceId: params.workspaceId as Id<"workspace">,
        paginationOpts: { numItems: PAGE_SIZE, cursor: null },
      })
    ),
});

function TagsPage() {
  const { workspaceId } = Route.useParams();
  return <TagsPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

function TagsPageSkeleton() {
  return (
    <PageContent className="mt-8 py-8" width="xl:w-2/3">
      <Skeleton className="h-8 w-32" />
      <div className="mt-8 flex flex-col gap-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton className="h-10 w-full" key={i} />
        ))}
      </div>
    </PageContent>
  );
}

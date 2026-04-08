import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Skeleton } from "@strand/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { PageContent } from "~/components/common/page-content";
import { TagsPageComponent } from "~/components/pages/tags-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/tags/"
)({
  pendingComponent: TagsPageSkeleton,
  component: TagsPage,
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

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { toastManager } from "@omi/ui/toast";
import { RiAddLine, RiCalendarLine } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { EmptyState } from "~/components/common/empty-state";
import { PageContent } from "~/components/common/page-content";
import { ResourceListSkeleton } from "~/components/pages/library-page/resource-list";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { useCachedPaginatedQuery } from "~/lib/use-cached-paginated-query";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";

const PAGE_SIZE = 20;

export function JournalPageComponent({
  workspaceId,
  selectedDate,
}: {
  workspaceId: Id<"workspace">;
  selectedDate?: string;
}) {
  const { results, status, loadMore } = useCachedPaginatedQuery(
    api.dailyNotes.queries.list,
    { workspaceId },
    PAGE_SIZE
  );

  const _todayString = useTodayString();
  const navigate = useNavigate();

  const { mutateAsync: getOrCreate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.dailyNotes.mutations.getOrCreate),
  });
  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });
  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });
  const { mutate: removeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });
  const { mutate: restoreMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
  });

  const createForDate = async (date: string) => {
    const resourceId = await getOrCreate({ workspaceId, date });
    navigate({
      to: "/workspace/$workspaceId/resource/$resourceId",
      params: { workspaceId, resourceId },
    });
  };

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );

  const handleTogglePin = useCallback(
    (resourceId: Id<"resource">) => {
      togglePin({ resourceId, workspaceId });
    },
    [togglePin, workspaceId]
  );

  const handleDelete = useCallback(
    (resourceId: Id<"resource">) => {
      removeMany({ workspaceId, resourceIds: [resourceId] });
      const { nextUrl } = closeResourceTabs(workspaceId, [resourceId]);
      if (nextUrl) {
        navigate({ to: nextUrl });
      }
      toastManager.add({
        type: "success",
        title: "Deleted",
        actionProps: {
          children: "Undo",
          onClick: () => {
            restoreMany({ workspaceId, resourceIds: [resourceId] });
          },
        },
      });
    },
    [removeMany, restoreMany, workspaceId, navigate]
  );

  const { ref: loadMoreRef, inView } = useInView();
  useEffect(() => {
    if (inView && status === "CanLoadMore") {
      loadMore(PAGE_SIZE);
    }
  }, [inView, status, loadMore]);

  const isLoadingFirstPage =
    status === "LoadingFirstPage" && results.length === 0;

  return (
    <PageContent className="pt-14 pb-4 md:pt-16" width="xl:w-2/3">
      <div className="flex flex-col gap-y-6">
        {isLoadingFirstPage ? (
          <ResourceListSkeleton />
        ) : results.length > 0 ? (
          <div className="-mx-3 flex flex-col gap-y-1">
            {results.map((entry) => (
              <ResourceRow
                isPinned={entry.isPinned}
                key={entry._id}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
                onUpdateTitle={handleUpdateTitle}
                resource={entry}
                workspaceId={workspaceId}
              />
            ))}
            <div className="h-px" ref={loadMoreRef} />
            {status === "LoadingMore" && <ResourceListSkeleton count={3} />}
          </div>
        ) : (
          <EmptyState
            action={
              <Button
                onClick={() => {
                  if (!selectedDate) {
                    return;
                  }
                  createForDate(selectedDate);
                }}
                size="xsmall"
                variant="outline"
              >
                <RiAddLine className="size-4" />
                Create entry
              </Button>
            }
            description="Capture a moment and your daily entries will live here."
            Icon={RiCalendarLine}
            title="No journal entries yet"
          />
        )}
      </div>
    </PageContent>
  );
}

function useTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

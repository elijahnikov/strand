import {
  useConvexMutation,
  useConvexPaginatedQuery,
} from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Skeleton } from "@omi/ui/skeleton";
import { RiDeleteBinLine } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { EmptyState } from "~/components/common/empty-state";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { SelectableRow } from "~/components/pages/library-page/selectable-resource-row";
import {
  type SelectionItem,
  useSelectAllHotkey,
} from "~/lib/selection/library-selection";

const PAGE_SIZE = 20;

// biome-ignore lint/suspicious/noEmptyBlockStatements: no-op for trash rows where pin/title edits don't apply
const noop = () => {};

export function TrashList({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { results, status, loadMore } = useConvexPaginatedQuery(
    api.resource.queries.listTrashed,
    { workspaceId },
    { initialNumItems: PAGE_SIZE }
  );

  const { mutate: restoreMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
  });

  const { mutate: purgeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.purgeMany),
  });

  const handleRestore = useCallback(
    (resourceId: Id<"resource">) => {
      restoreMany({ workspaceId, resourceIds: [resourceId] });
    },
    [restoreMany, workspaceId]
  );

  const handlePurge = useCallback(
    (resourceId: Id<"resource">) => {
      purgeMany({ workspaceId, resourceIds: [resourceId] });
    },
    [purgeMany, workspaceId]
  );

  const orderedItems = useMemo<SelectionItem[]>(
    () => results.map((r) => ({ kind: "resource", id: r._id })),
    [results]
  );
  useSelectAllHotkey(orderedItems);

  const { ref: loadMoreRef, inView } = useInView();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (results.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
    }
  }, [results.length]);

  useEffect(() => {
    if (inView && status === "CanLoadMore") {
      loadMore(PAGE_SIZE);
    }
  }, [inView, status, loadMore]);

  const isFirstLoad = status === "LoadingFirstPage" && results.length === 0;
  const isEmpty = results.length === 0 && !isFirstLoad;

  if (isFirstLoad) {
    return <TrashListSkeleton />;
  }

  if (isEmpty) {
    return (
      <EmptyState
        description="Deleted resources appear here and are permanently removed after 30 days."
        Icon={RiDeleteBinLine}
        title="Trash is empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-y-1">
      <AnimatePresence>
        {results.map((resource, i) => (
          <SelectableRow
            item={{ kind: "resource", id: resource._id }}
            key={resource._id}
            orderedItems={orderedItems}
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              initial={initialLoadDone.current ? false : { opacity: 0, y: 8 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35,
                delay: initialLoadDone.current ? 0 : i * 0.03,
              }}
            >
              <ResourceRow
                isPinned={false}
                onPurge={handlePurge}
                onRestore={handleRestore}
                onTogglePin={noop}
                onUpdateTitle={noop}
                resource={resource}
                variant="trash"
                workspaceId={workspaceId}
              />
            </motion.div>
          </SelectableRow>
        ))}
      </AnimatePresence>
      <div className="h-px" ref={loadMoreRef} />
      {status === "LoadingMore" && <LoadingMoreSkeleton />}
    </div>
  );
}

function TrashListSkeleton() {
  return (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton className="h-11 w-full" key={`trash-skel-${i}`} />
      ))}
    </div>
  );
}

function LoadingMoreSkeleton() {
  return (
    <div className="flex flex-col gap-y-2 py-2">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <Skeleton
          className="h-11 w-full"
          key={`trash-loading-${i.toString()}`}
        />
      ))}
    </div>
  );
}

import {
  useConvexMutation,
  useConvexPaginatedQuery,
} from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Heading } from "@strand/ui/heading";
import { Kbd } from "@strand/ui/kbd";
import { Skeleton } from "@strand/ui/skeleton";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { ResourceRow, UploadingFileRow } from "./resource-row";

const PAGE_SIZE = 20;

export function ResourceList({
  workspaceId,
  uploadingFiles,
  search,
  type,
  order,
}: {
  uploadingFiles: { id: string; name: string }[];
  workspaceId: Id<"workspace">;
  search?: string;
  type?: "website" | "note" | "file";
  order?: "newest" | "oldest" | "alphabetical";
}) {
  const { results, status, loadMore } = useConvexPaginatedQuery(
    api.resource.queries.list,
    { workspaceId, search: search || undefined, type, order },
    { initialNumItems: PAGE_SIZE }
  );

  const updateTitle = useConvexMutation(api.resource.mutations.updateTitle);

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );

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

  if (results.length === 0 && uploadingFiles.length === 0) {
    if (status === "LoadingFirstPage") {
      return <ResourceListSkeleton />;
    }

    if (search || type) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Heading className="font-medium text-sm text-ui-fg-subtle">
            No results found.
          </Heading>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Heading className="font-medium text-sm text-ui-fg-subtle">
          No resources yet. Paste a URL, text, or file to get started.
        </Heading>
        <p className="mt-1 text-ui-fg-muted text-xs">
          Press <Kbd>Ctrl+V</Kbd> or <Kbd>⌘V</Kbd> anywhere on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <AnimatePresence>
        {uploadingFiles.map((file) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, y: 8 }}
            key={file.id}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <UploadingFileRow fileName={file.name} />
          </motion.div>
        ))}
        {results.map((resource, i) => (
          <MemoizedResourceItem
            handleUpdateTitle={handleUpdateTitle}
            index={i}
            initialLoadDone={initialLoadDone.current}
            key={resource._id}
            resource={resource}
            workspaceId={workspaceId}
          />
        ))}
      </AnimatePresence>
      <div className="h-px" ref={loadMoreRef} />
      {status === "LoadingMore" && <LoadingMoreSkeleton />}
    </div>
  );
}

const MemoizedResourceItem = memo(function ResourceItem({
  resource,
  handleUpdateTitle,
  workspaceId,
  initialLoadDone,
  index,
}: {
  resource: Parameters<typeof ResourceRow>[0]["resource"];
  handleUpdateTitle: (resourceId: Id<"resource">, title: string) => void;
  workspaceId: Id<"workspace">;
  initialLoadDone: boolean;
  index: number;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      initial={initialLoadDone ? false : { opacity: 0, y: 8 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 35,
        delay: initialLoadDone ? 0 : index * 0.03,
      }}
    >
      <ResourceRow
        onUpdateTitle={handleUpdateTitle}
        resource={resource}
        workspaceId={workspaceId}
      />
    </motion.div>
  );
});

function LoadingMoreSkeleton() {
  return (
    <div className="flex flex-col gap-y-2 py-2">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <Skeleton className="h-11 w-full" key={`loading-${i.toString()}`} />
      ))}
    </div>
  );
}

export function ResourceListSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton className="h-11 w-full" key={i} />
      ))}
    </div>
  );
}

import {
  convexQuery,
  useConvexMutation,
  useConvexPaginatedQuery,
} from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Heading } from "@strand/ui/heading";
import { Kbd } from "@strand/ui/kbd";
import { Separator } from "@strand/ui/separator";
import { Skeleton } from "@strand/ui/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { CollectionRow } from "./collection-row";
import { useLibraryFilters } from "./library-toolbar";
import { ResourceRow, UploadingFileRow } from "./resource-row";

const PAGE_SIZE = 20;

type ListItem =
  | {
      kind: "collection";
      collection: {
        _id: Id<"collection">;
        name: string;
        icon?: string | null;
        _creationTime: number;
      };
    }
  | {
      kind: "resource";
      resource: Parameters<typeof ResourceRow>[0]["resource"];
    };

export function ResourceList({
  workspaceId,
  uploadingFiles,
  onClearBatch,
  collectionId,
}: {
  uploadingFiles: { id: string; name: string; batchId: string }[];
  onClearBatch: (batchId: string) => void;
  workspaceId: Id<"workspace">;
  collectionId?: Id<"collection">;
}) {
  const { search, type, order } = useLibraryFilters();

  const { results, status, loadMore } = useConvexPaginatedQuery(
    api.resource.queries.list,
    {
      workspaceId,
      search: search || undefined,
      type: type ?? undefined,
      order: order ?? undefined,
      collectionId,
    },
    { initialNumItems: PAGE_SIZE }
  );

  const showCollections = !(search || type);
  const { data: childCollections, isLoading: collectionsLoading } = useQuery(
    convexQuery(
      api.collection.queries.listChildren,
      showCollections
        ? {
            workspaceId,
            parentId: collectionId,
          }
        : "skip"
    )
  );

  const { data: serverPinned } = useQuery(
    convexQuery(api.resource.queries.listPinned, { workspaceId })
  );

  const pinnedIdSet = useMemo(
    () => new Set((serverPinned ?? []).map((r) => r._id)),
    [serverPinned]
  );

  const uploadingNameSet = useMemo(
    () => new Set(uploadingFiles.map((f) => f.name)),
    [uploadingFiles]
  );

  // Group uploads by batch — clear entire batch when all its resources appear in results
  const batches = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of uploadingFiles) {
      const names = map.get(f.batchId) ?? [];
      names.push(f.name);
      map.set(f.batchId, names);
    }
    return map;
  }, [uploadingFiles]);

  const pendingResultTitles = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      const aiStatus = "aiStatus" in r ? r.aiStatus : null;
      if (aiStatus === "pending" || aiStatus === "processing") {
        set.add(r.title);
      }
    }
    return set;
  }, [results]);

  useEffect(() => {
    for (const [batchId, names] of batches) {
      if (names.every((name) => pendingResultTitles.has(name))) {
        onClearBatch(batchId);
      }
    }
  }, [batches, pendingResultTitles, onClearBatch]);

  const unpinnedResults = useMemo(
    () =>
      results.filter((r) => {
        if (pinnedIdSet.has(r._id)) {
          return false;
        }
        if (!uploadingNameSet.has(r.title)) {
          return true;
        }
        // Only hide if this is the newly created resource (pending AI), not an older duplicate
        const aiStatus = "aiStatus" in r ? r.aiStatus : null;
        return aiStatus !== "pending" && aiStatus !== "processing";
      }),
    [results, pinnedIdSet, uploadingNameSet]
  );

  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });

  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });

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

  // Merge collections into the resource list based on sort order
  const filteredCollections = childCollections ?? [];

  const mergedList = useMemo((): ListItem[] => {
    const resourceItems: ListItem[] = unpinnedResults.map((r) => ({
      kind: "resource" as const,
      resource: r,
    }));

    if (filteredCollections.length === 0) {
      return resourceItems;
    }

    const collectionItems: ListItem[] = filteredCollections.map((c) => ({
      kind: "collection" as const,
      collection: c,
    }));

    if (order === "alphabetical") {
      const getName = (item: ListItem) =>
        item.kind === "collection" ? item.collection.name : item.resource.title;
      return [...collectionItems, ...resourceItems].sort((a, b) =>
        getName(a).localeCompare(getName(b))
      );
    }

    const getTime = (item: ListItem) =>
      item.kind === "collection"
        ? item.collection._creationTime
        : item.resource._creationTime;

    if (order === "oldest") {
      return [...collectionItems, ...resourceItems].sort(
        (a, b) => getTime(a) - getTime(b)
      );
    }

    // Default: newest first
    return [...collectionItems, ...resourceItems].sort(
      (a, b) => getTime(b) - getTime(a)
    );
  }, [unpinnedResults, filteredCollections, order]);

  const hasPinned = serverPinned && serverPinned.length > 0;
  const isEmpty =
    mergedList.length === 0 && !hasPinned && uploadingFiles.length === 0;

  if (status === "LoadingFirstPage" || collectionsLoading) {
    return <ResourceListSkeleton />;
  }

  if (isEmpty) {
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
      {hasPinned && (
        <>
          <AnimatePresence>
            {serverPinned.map((resource) => (
              <MemoizedResourceItem
                handleTogglePin={handleTogglePin}
                handleUpdateTitle={handleUpdateTitle}
                index={0}
                initialLoadDone
                isPinned
                key={resource._id}
                resource={resource}
                workspaceId={workspaceId}
              />
            ))}
          </AnimatePresence>
          <Separator className="my-1" />
        </>
      )}
      {uploadingFiles.map((file) => (
        <UploadingFileRow fileName={file.name} key={file.id} />
      ))}
      <AnimatePresence>
        {mergedList.map((item, i) =>
          item.kind === "collection" ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              initial={initialLoadDone.current ? false : { opacity: 0, y: 8 }}
              key={`col-${item.collection._id}`}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35,
                delay: initialLoadDone.current ? 0 : i * 0.03,
              }}
            >
              <CollectionRow
                collection={item.collection}
                workspaceId={workspaceId}
              />
            </motion.div>
          ) : (
            <MemoizedResourceItem
              handleTogglePin={handleTogglePin}
              handleUpdateTitle={handleUpdateTitle}
              index={i}
              initialLoadDone={initialLoadDone.current}
              isPinned={false}
              key={item.resource._id}
              resource={item.resource}
              workspaceId={workspaceId}
            />
          )
        )}
      </AnimatePresence>
      <div className="h-px" ref={loadMoreRef} />
      {status === "LoadingMore" && <LoadingMoreSkeleton />}
    </div>
  );
}

const MemoizedResourceItem = memo(function ResourceItem({
  resource,
  handleUpdateTitle,
  handleTogglePin,
  workspaceId,
  isPinned,
  initialLoadDone,
  index,
}: {
  resource: Parameters<typeof ResourceRow>[0]["resource"];
  handleUpdateTitle: (resourceId: Id<"resource">, title: string) => void;
  handleTogglePin: (resourceId: Id<"resource">) => void;
  workspaceId: Id<"workspace">;
  isPinned: boolean;
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
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
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

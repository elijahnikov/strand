import {
  convexQuery,
  useConvexMutation,
  useConvexPaginatedQuery,
} from "@convex-dev/react-query";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { RiPushpinFill, RiStackFill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Badge } from "@strand/ui/badge";
import { Separator } from "@strand/ui/separator";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { EmptyState } from "~/components/common/empty-state";
import { SelectionDock } from "~/components/common/selection-dock";
import {
  type ListNavItem,
  useListNavigation,
} from "~/lib/hotkeys/use-list-navigation";
import {
  LibrarySelectionProvider,
  type SelectionItem,
  useSelectAllHotkey,
} from "~/lib/selection/library-selection";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";
import { CollectionRow } from "./collection-row";
import { LibraryDragOverlay } from "./drag-overlay";
import { useLibraryFilters } from "./library-toolbar";
import { ResourceRow, UploadingFileRow } from "./resource-row";
import { SelectableRow } from "./selectable-resource-row";
import { useLibraryDnd } from "./use-library-dnd";

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

interface ResourceListProps {
  collectionId?: Id<"collection">;
  onClearBatch: (batchId: string) => void;
  onClearPendingCollection?: () => void;
  pendingCollection?: { id: string; name: string } | null;
  uploadingFiles: { id: string; name: string; batchId: string }[];
  workspaceId: Id<"workspace">;
}

export function ResourceList(props: ResourceListProps) {
  return (
    <LibrarySelectionProvider>
      <ResourceListContent {...props} />
    </LibrarySelectionProvider>
  );
}

function ResourceListContent({
  workspaceId,
  uploadingFiles,
  onClearBatch,
  collectionId,
  pendingCollection,
  onClearPendingCollection,
}: {
  uploadingFiles: { id: string; name: string; batchId: string }[];
  onClearBatch: (batchId: string) => void;
  workspaceId: Id<"workspace">;
  collectionId?: Id<"collection">;
  pendingCollection?: { id: string; name: string } | null;
  onClearPendingCollection?: () => void;
}) {
  const {
    sensors,
    activeItem,
    movingIds,
    clearMovingIds,
    onDragStart,
    onDragEnd,
    onDragCancel,
  } = useLibraryDnd(workspaceId);
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

  const showPinned = !collectionId;

  const { data: serverPinned } = useQuery(
    convexQuery(
      api.resource.queries.listPinned,
      showPinned ? { workspaceId } : "skip"
    )
  );

  const pinnedIdSet = useMemo<Set<Id<"resource">>>(
    () =>
      showPinned
        ? new Set((serverPinned ?? []).map((r) => r._id))
        : new Set<Id<"resource">>(),
    [serverPinned, showPinned]
  );

  const uploadingNameSet = useMemo(
    () => new Set(uploadingFiles.map((f) => f.name)),
    [uploadingFiles]
  );

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

  useEffect(() => {
    if (!(pendingCollection && childCollections)) {
      return;
    }
    const found = childCollections.some(
      (c) => "name" in c && c.name === pendingCollection.name
    );
    if (found) {
      onClearPendingCollection?.();
    }
  }, [childCollections, pendingCollection, onClearPendingCollection]);

  const unpinnedResults = useMemo(
    () =>
      results.filter((r) => {
        if (pinnedIdSet.has(r._id) || movingIds.has(r._id)) {
          return false;
        }
        if (!uploadingNameSet.has(r.title)) {
          return true;
        }
        const aiStatus = "aiStatus" in r ? r.aiStatus : null;
        return aiStatus !== "pending" && aiStatus !== "processing";
      }),
    [results, pinnedIdSet, uploadingNameSet, movingIds]
  );

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

  const navigate = useNavigate();

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

  useEffect(() => {
    if (status === "CanLoadMore" && unpinnedResults.length < PAGE_SIZE) {
      loadMore(PAGE_SIZE);
    }
  }, [status, unpinnedResults.length, loadMore]);

  const filteredCollections = useMemo(() => {
    const collections = childCollections ?? [];
    return collections.filter((c) => {
      if (movingIds.has(c._id)) {
        return false;
      }
      if (
        pendingCollection &&
        "name" in c &&
        c.name === pendingCollection.name
      ) {
        return false;
      }
      return true;
    });
  }, [childCollections, pendingCollection, movingIds]);

  useEffect(() => {
    if (movingIds.size === 0) {
      return;
    }
    const resultIds = new Set(results.map((r) => r._id));
    const collectionIds = new Set((childCollections ?? []).map((c) => c._id));
    const stale = [...movingIds].filter(
      (id) => !(resultIds.has(id as never) || collectionIds.has(id as never))
    );
    if (stale.length > 0) {
      clearMovingIds(stale);
    }
  }, [results, childCollections, movingIds, clearMovingIds]);

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

    return [...collectionItems, ...resourceItems].sort(
      (a, b) => getTime(b) - getTime(a)
    );
  }, [unpinnedResults, filteredCollections, order]);

  const hasPinned = showPinned && serverPinned && serverPinned.length > 0;
  const isFirstLoad =
    (status === "LoadingFirstPage" && results.length === 0) ||
    (collectionsLoading && !childCollections);
  const isEmpty =
    mergedList.length === 0 && !hasPinned && uploadingFiles.length === 0;

  const navItems = useMemo<ListNavItem[]>(() => {
    const items: ListNavItem[] = [];
    if (hasPinned) {
      for (const resource of serverPinned) {
        items.push({
          id: `pinned-${resource._id}`,
          open: () =>
            navigate({
              to: "/workspace/$workspaceId/resource/$resourceId",
              params: { workspaceId, resourceId: resource._id },
            }),
        });
      }
    }
    for (const item of mergedList) {
      if (item.kind === "collection") {
        items.push({
          id: `col-${item.collection._id}`,
          open: () =>
            navigate({
              to: "/workspace/$workspaceId/library/collection/$collectionId",
              params: { workspaceId, collectionId: item.collection._id },
            }),
        });
      } else {
        items.push({
          id: `res-${item.resource._id}`,
          open: () =>
            navigate({
              to: "/workspace/$workspaceId/resource/$resourceId",
              params: { workspaceId, resourceId: item.resource._id },
            }),
        });
      }
    }
    return items;
  }, [hasPinned, serverPinned, mergedList, navigate, workspaceId]);

  const { activeId } = useListNavigation(navItems);

  const orderedItems = useMemo<SelectionItem[]>(() => {
    const items: SelectionItem[] = [];
    if (hasPinned) {
      for (const r of serverPinned) {
        items.push({ kind: "resource", id: r._id });
      }
    }
    for (const entry of mergedList) {
      if (entry.kind === "collection") {
        items.push({ kind: "collection", id: entry.collection._id });
      } else {
        items.push({ kind: "resource", id: entry.resource._id });
      }
    }
    return items;
  }, [hasPinned, serverPinned, mergedList]);

  if (isFirstLoad) {
    return <ResourceListSkeleton />;
  }

  if (isEmpty) {
    if (search || type) {
      return (
        <EmptyState
          description="Try a different search or clear your filter."
          Icon={RiStackFill}
          title="No results found"
        />
      );
    }

    return (
      <EmptyState
        description={
          <>
            Paste a URL, text, or file to get started. Press{" "}
            <Badge size={"sm"} variant={"mono"}>
              Ctrl+V
            </Badge>{" "}
            or{" "}
            <Badge size={"sm"} variant={"mono"}>
              ⌘V
            </Badge>{" "}
            anywhere on this page.
          </>
        }
        Icon={RiStackFill}
        title="No resources yet"
      />
    );
  }

  return (
    <>
      <SelectAllRegister items={orderedItems} />
      <DndContext
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <div className="flex flex-col gap-y-1">
          {hasPinned && (
            <>
              <div className="ml-4 flex items-center gap-x-1">
                <RiPushpinFill className="size-4 shrink-0 text-ui-fg-muted" />
                <Text className="font-medium text-sm text-ui-fg-muted">
                  Pinned
                </Text>
              </div>
              <AnimatePresence>
                {serverPinned.map((resource) => {
                  const navId = `pinned-${resource._id}`;
                  return (
                    <SelectableRow
                      item={{ kind: "resource", id: resource._id }}
                      key={resource._id}
                      orderedItems={orderedItems}
                    >
                      <div
                        className={cn(
                          "rounded-lg",
                          activeId === navId &&
                            "ring-2 ring-ui-fg-interactive ring-inset"
                        )}
                        data-nav-active={activeId === navId}
                      >
                        <MemoizedResourceItem
                          handleDelete={handleDelete}
                          handleTogglePin={handleTogglePin}
                          handleUpdateTitle={handleUpdateTitle}
                          index={0}
                          initialLoadDone
                          isPinned
                          resource={resource}
                          workspaceId={workspaceId}
                        />
                      </div>
                    </SelectableRow>
                  );
                })}
              </AnimatePresence>
              <Separator className="my-1 h-[0.5px]!" />
            </>
          )}
          {pendingCollection && (
            <CollectionRow
              autoEdit
              collection={{
                _id: pendingCollection.id as Id<"collection">,
                name: pendingCollection.name,
                _creationTime: Date.now(),
              }}
              workspaceId={workspaceId}
            />
          )}
          {uploadingFiles.map((file) => (
            <UploadingFileRow fileName={file.name} key={file.id} />
          ))}
          <AnimatePresence>
            {mergedList.map((item, i) => {
              const navId =
                item.kind === "collection"
                  ? `col-${item.collection._id}`
                  : `res-${item.resource._id}`;
              const isActive = activeId === navId;
              return item.kind === "collection" ? (
                <SelectableRow
                  item={{ kind: "collection", id: item.collection._id }}
                  key={`col-${item.collection._id}`}
                  orderedItems={orderedItems}
                >
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-lg",
                      isActive && "ring-2 ring-ui-fg-interactive ring-inset"
                    )}
                    data-nav-active={isActive}
                    exit={{ opacity: 0, height: 0 }}
                    initial={
                      initialLoadDone.current ? false : { opacity: 0, y: 8 }
                    }
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
                </SelectableRow>
              ) : (
                <SelectableRow
                  item={{ kind: "resource", id: item.resource._id }}
                  key={item.resource._id}
                  orderedItems={orderedItems}
                >
                  <div
                    className={cn(
                      "rounded-lg",
                      isActive && "ring-2 ring-ui-fg-interactive ring-inset"
                    )}
                    data-nav-active={isActive}
                  >
                    <MemoizedResourceItem
                      handleDelete={handleDelete}
                      handleTogglePin={handleTogglePin}
                      handleUpdateTitle={handleUpdateTitle}
                      index={i}
                      initialLoadDone={initialLoadDone.current}
                      isPinned={false}
                      resource={item.resource}
                      workspaceId={workspaceId}
                    />
                  </div>
                </SelectableRow>
              );
            })}
          </AnimatePresence>
          <div className="h-px" ref={loadMoreRef} />
          {status === "LoadingMore" && <LoadingMoreSkeleton />}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <LibraryDragOverlay item={activeItem} workspaceId={workspaceId} />
          ) : null}
        </DragOverlay>
      </DndContext>
      <SelectionDock workspaceId={workspaceId} />
    </>
  );
}

const MemoizedResourceItem = memo(function ResourceItem({
  resource,
  handleUpdateTitle,
  handleTogglePin,
  handleDelete,
  workspaceId,
  isPinned,
  initialLoadDone,
  index,
}: {
  handleDelete: (resourceId: Id<"resource">) => void;
  handleTogglePin: (resourceId: Id<"resource">) => void;
  handleUpdateTitle: (resourceId: Id<"resource">, title: string) => void;
  index: number;
  initialLoadDone: boolean;
  isPinned: boolean;
  resource: Parameters<typeof ResourceRow>[0]["resource"];
  workspaceId: Id<"workspace">;
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
        onDelete={handleDelete}
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

function SelectAllRegister({ items }: { items: SelectionItem[] }) {
  useSelectAllHotkey(items);
  return null;
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

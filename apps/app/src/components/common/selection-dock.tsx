import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import {
  RiAddLine,
  RiCloseFill,
  RiDeleteBin6Line,
  RiFolderLine,
  RiPushpinFill,
  RiPushpinLine,
} from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Button } from "@strand/ui/button";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@strand/ui/command";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@strand/ui/popover";
import { Separator } from "@strand/ui/separator";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useMemo, useState } from "react";
import { useLibrarySelection } from "~/lib/selection/library-selection";

export function SelectionDock({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { clear, count, selectedCollectionIds, selectedResourceIds } =
    useLibrarySelection();

  if (count === 0) {
    return (
      <AnimatePresence>
        {/* placeholder so exit animations still fire */}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x-1 rounded-full border-[0.5px] bg-ui-bg-component py-1 pr-1 pl-0.25"
        exit={{ opacity: 0, y: 8 }}
        initial={{ opacity: 0, y: 8 }}
        key="dock"
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        <Badge
          className="mx-1 mr-0 rounded-full px-2 py-0.25"
          variant={"secondary"}
        >
          <Text className="py-0.5 font-medium font-mono text-ui-fg-base text-xs">
            {count} selected
          </Text>
        </Badge>
        <Separator aria-hidden className="mx-1 h-4" orientation="vertical" />
        <MoveButton
          collectionIds={selectedCollectionIds}
          onDone={clear}
          resourceIds={selectedResourceIds}
          workspaceId={workspaceId}
        />
        {selectedResourceIds.length > 0 ? (
          <PinButton
            onDone={clear}
            resourceIds={selectedResourceIds}
            workspaceId={workspaceId}
          />
        ) : null}
        <DeleteButton
          collectionIds={selectedCollectionIds}
          onDone={clear}
          resourceIds={selectedResourceIds}
          workspaceId={workspaceId}
        />
        <Separator aria-hidden className="ml-1 h-4" orientation="vertical" />
        <Button
          aria-label="Clear selection"
          className="size-6 rounded-full"
          onClick={clear}
          size="small"
          variant="ghost"
        >
          <RiCloseFill className="size-4 shrink-0" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

interface CollectionChoice {
  _id: Id<"collection"> | "__root__";
  icon?: string | null;
  name: string;
}

interface CollectionGroup {
  items: CollectionChoice[];
  value: string;
}

function MoveButton({
  workspaceId,
  resourceIds,
  collectionIds,
  onDone,
}: {
  collectionIds: Id<"collection">[];
  onDone: () => void;
  resourceIds: Id<"resource">[];
  workspaceId: Id<"workspace">;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: collections, isPending: collectionsLoading } = useQuery(
    convexQuery(api.collection.queries.listAll, open ? { workspaceId } : "skip")
  );
  const { mutateAsync: moveResourcesAsync, isPending: moveResourcesPending } =
    useMutation({
      mutationFn: useConvexMutation(
        api.resource.mutations.moveManyToCollection
      ),
    });
  const {
    mutateAsync: moveCollectionsAsync,
    isPending: moveCollectionsPending,
  } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.moveMany),
  });
  const { mutateAsync: createCollectionAsync, isPending: createIsPending } =
    useMutation({
      mutationFn: useConvexMutation(api.collection.mutations.create),
    });

  const trimmedQuery = query.trim();
  const totalCount = resourceIds.length + collectionIds.length;

  const selectableCollections = useMemo(() => {
    const list = collections ?? [];
    const selectedSet = new Set(collectionIds);
    return list.filter((c) => !selectedSet.has(c._id));
  }, [collections, collectionIds]);

  const filteredCollections = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    return selectableCollections.filter((c) =>
      q ? c.name.toLowerCase().includes(q) : true
    );
  }, [selectableCollections, trimmedQuery]);

  const exactMatch = useMemo(() => {
    if (!trimmedQuery) {
      return false;
    }
    const q = trimmedQuery.toLowerCase();
    return (collections ?? []).some((c) => c.name.toLowerCase() === q);
  }, [collections, trimmedQuery]);

  const runMove = async (targetId: Id<"collection"> | undefined) => {
    const ops: Promise<unknown>[] = [];
    if (resourceIds.length > 0) {
      ops.push(
        moveResourcesAsync({
          workspaceId,
          resourceIds,
          collectionId: targetId,
        })
      );
    }
    if (collectionIds.length > 0) {
      ops.push(
        moveCollectionsAsync({
          workspaceId,
          collectionIds,
          newParentId: targetId,
        })
      );
    }
    try {
      await Promise.all(ops);
      toastManager.add({
        type: "success",
        title: totalCount === 1 ? "Moved 1 item" : `Moved ${totalCount} items`,
      });
      setOpen(false);
      setQuery("");
      onDone();
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not move",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleMove = (collectionId: Id<"collection"> | undefined) => {
    void runMove(collectionId);
  };

  const handleCreateAndMove = async () => {
    if (!trimmedQuery) {
      return;
    }
    try {
      const newId = await createCollectionAsync({
        workspaceId,
        name: trimmedQuery,
      });
      await runMove(newId);
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not create collection",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const isBusy =
    moveResourcesPending || moveCollectionsPending || createIsPending;

  const groups: CollectionGroup[] = [
    {
      value: "Collections",
      items: [
        ...filteredCollections.map((c) => ({
          _id: c._id,
          name: c.name,
          icon: c.icon ?? null,
        })),
      ],
    },
  ];

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="h-6 gap-x-1.5 rounded-md px-2 text-xs"
            disabled={isBusy}
            size="small"
            variant="ghost"
          >
            <RiFolderLine className="size-3.5 shrink-0" />
            Move
          </Button>
        }
      />
      <PopoverContent
        align="center"
        className="w-72 bg-ui-bg-component p-0!"
        side="top"
        sideOffset={10}
      >
        <Command items={groups} onValueChange={setQuery} value={query}>
          <CommandPanel className="bg-ui-bg-component!">
            <CommandInput
              className="text-sm"
              placeholder="Search or create a collection…"
            />
            {collectionsLoading ? (
              <div className="flex flex-col gap-y-1 px-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    className="h-7 w-full"
                    key={`collection-skel-${i}`}
                  />
                ))}
              </div>
            ) : (
              <CommandEmpty>No collections match.</CommandEmpty>
            )}
            <CommandList className="max-h-64 overflow-y-auto bg-ui-bg-component px-0! pt-1! pb-1!">
              {(group: CollectionGroup) => (
                <Fragment key={group.value}>
                  <CommandGroup className="px-1" items={group.items}>
                    <CommandItem
                      className="px-3"
                      onClick={() => handleMove(undefined)}
                    >
                      Move to root
                    </CommandItem>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: CollectionChoice) => (
                        <CommandItem
                          className="mx-0.5 flex items-center gap-x-2 px-2"
                          key={item._id}
                          onClick={() =>
                            handleMove(item._id as Id<"collection">)
                          }
                          value={item._id}
                        >
                          {item.icon ? (
                            <span>{item.icon}</span>
                          ) : (
                            <FolderIcon className="size-3.5 shrink-0 text-ui-fg-muted" />
                          )}
                          <Text className="flex-1 truncate text-sm">
                            {item.name}
                          </Text>
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                </Fragment>
              )}
            </CommandList>
            {trimmedQuery && !exactMatch && !collectionsLoading ? (
              <div className="border-t-[0.5px] p-1">
                <button
                  className="flex w-full items-center gap-x-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-ui-bg-component-hover"
                  disabled={isBusy}
                  onClick={() => void handleCreateAndMove()}
                  type="button"
                >
                  <RiAddLine className="size-3.5 shrink-0 text-ui-fg-muted" />
                  <span className="flex-1 truncate">
                    Create <span className="font-medium">"{trimmedQuery}"</span>
                  </span>
                </button>
              </div>
            ) : null}
          </CommandPanel>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PinButton({
  workspaceId,
  resourceIds,
  onDone,
}: {
  onDone: () => void;
  resourceIds: Id<"resource">[];
  workspaceId: Id<"workspace">;
}) {
  const { data: pinned } = useQuery(
    convexQuery(api.resource.queries.listPinned, { workspaceId })
  );
  const allPinned = useMemo(() => {
    if (!pinned) {
      return false;
    }
    const pinnedIds = new Set(pinned.map((p) => p._id));
    return resourceIds.every((id) => pinnedIds.has(id));
  }, [pinned, resourceIds]);

  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePinMany),
  });

  const handleClick = () => {
    const nextPinned = !allPinned;
    mutate(
      { workspaceId, resourceIds, pinned: nextPinned },
      {
        onSuccess: () => {
          onDone();
        },
        onError: (err) => {
          toastManager.add({
            type: "error",
            title: "Could not update pins",
            description: err instanceof Error ? err.message : String(err),
          });
        },
      }
    );
  };

  return (
    <Button
      className="h-6 gap-x-1.5 rounded-md px-2 text-xs"
      disabled={isPending}
      onClick={handleClick}
      size="small"
      variant="ghost"
    >
      {allPinned ? (
        <RiPushpinFill className="size-3.5 shrink-0" />
      ) : (
        <RiPushpinLine className="size-3.5 shrink-0" />
      )}
      {allPinned ? "Unpin" : "Pin"}
    </Button>
  );
}

function DeleteButton({
  workspaceId,
  resourceIds,
  collectionIds,
  onDone,
}: {
  collectionIds: Id<"collection">[];
  onDone: () => void;
  resourceIds: Id<"resource">[];
  workspaceId: Id<"workspace">;
}) {
  const [open, setOpen] = useState(false);
  const {
    mutateAsync: removeResourcesAsync,
    isPending: removeResourcesPending,
  } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });
  const {
    mutateAsync: removeCollectionsAsync,
    isPending: removeCollectionsPending,
  } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.removeMany),
  });

  const totalCount = resourceIds.length + collectionIds.length;
  const isPending = removeResourcesPending || removeCollectionsPending;

  const handleConfirm = async () => {
    const ops: Promise<unknown>[] = [];
    if (resourceIds.length > 0) {
      ops.push(removeResourcesAsync({ workspaceId, resourceIds }));
    }
    if (collectionIds.length > 0) {
      ops.push(removeCollectionsAsync({ workspaceId, collectionIds }));
    }
    try {
      await Promise.all(ops);
      toastManager.add({
        type: "success",
        title:
          totalCount === 1 ? "Deleted 1 item" : `Deleted ${totalCount} items`,
      });
      setOpen(false);
      onDone();
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not delete",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const describeDeletion = () => {
    if (resourceIds.length > 0 && collectionIds.length > 0) {
      return `${totalCount} items (${resourceIds.length} resource${resourceIds.length === 1 ? "" : "s"}, ${collectionIds.length} collection${collectionIds.length === 1 ? "" : "s"}) will be removed. Collections' contents will be moved to the root.`;
    }
    if (collectionIds.length > 0) {
      return collectionIds.length === 1
        ? "This collection will be removed. Its contents will be moved to the root."
        : `${collectionIds.length} collections will be removed. Their contents will be moved to the root.`;
    }
    return resourceIds.length === 1
      ? "This resource will be removed from your library."
      : `${resourceIds.length} resources will be removed from your library.`;
  };

  return (
    <>
      <Button
        className="h-6 gap-x-1.5 rounded-md px-2 text-ui-fg-error text-xs hover:text-ui-fg-error"
        onClick={() => setOpen(true)}
        size="small"
        variant="ghost"
      >
        <RiDeleteBin6Line className="size-3.5 shrink-0" />
        Delete
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="max-w-sm!">
          <DialogHeader>
            <div>
              <DialogTitle className="font-medium text-sm">
                Delete items?
              </DialogTitle>
            </div>
          </DialogHeader>
          <Text className="p-3">{describeDeletion()}</Text>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              size="small"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() => void handleConfirm()}
              size="small"
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

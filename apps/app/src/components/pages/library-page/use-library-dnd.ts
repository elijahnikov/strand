import { useConvexMutation } from "@convex-dev/react-query";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useLibrarySelection } from "~/lib/selection/library-selection";

interface DragBatch {
  collectionIds: Id<"collection">[];
  resourceIds: Id<"resource">[];
}

export type DragItemData =
  | {
      type: "resource";
      resourceId: Id<"resource">;
      resource: unknown;
    }
  | {
      type: "collection";
      collectionId: Id<"collection">;
      collection: {
        _id: Id<"collection">;
        name: string;
        icon?: string | null;
        _creationTime: number;
      };
    };

export interface ActiveDragItem {
  batch: DragBatch | null;
  data: DragItemData;
}

export interface DropTargetData {
  collectionId: Id<"collection">;
}

export function useLibraryDnd(workspaceId: Id<"workspace">) {
  const { clear, isSelected, selectedCollectionIds, selectedResourceIds } =
    useLibrarySelection();
  const [activeItem, setActiveItem] = useState<ActiveDragItem | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(() => new Set());

  const selectionRef = useRef({
    resourceIds: selectedResourceIds,
    collectionIds: selectedCollectionIds,
    isSelected,
  });
  selectionRef.current = {
    resourceIds: selectedResourceIds,
    collectionIds: selectedCollectionIds,
    isSelected,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const { mutate: moveToCollection } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.moveToCollection),
  });

  const { mutate: moveCollection } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.move),
  });

  const { mutateAsync: moveManyToCollection } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.moveManyToCollection),
  });

  const { mutateAsync: moveManyCollections } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.moveMany),
  });

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined;
    if (!data) {
      return;
    }

    const sel = selectionRef.current;
    const activeId =
      data.type === "resource" ? data.resourceId : data.collectionId;
    const activeKind: "resource" | "collection" = data.type;
    const activeItemSelected = sel.isSelected(
      activeKind === "resource"
        ? { kind: "resource", id: activeId as Id<"resource"> }
        : { kind: "collection", id: activeId as Id<"collection"> }
    );

    let batch: DragBatch | null = null;
    if (activeItemSelected) {
      const totalSelected = sel.resourceIds.length + sel.collectionIds.length;
      if (totalSelected > 1) {
        batch = {
          resourceIds: sel.resourceIds,
          collectionIds: sel.collectionIds,
        };
      }
    }

    setActiveItem({ data, batch });
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const current = activeItemRef.current;
      setActiveItem(null);

      const active = event.active.data.current as DragItemData | undefined;
      const over = event.over?.data.current as DropTargetData | undefined;

      if (!(active && over)) {
        return;
      }

      const batch = current?.batch ?? null;
      const targetId = over.collectionId;

      if (batch) {
        // Multi-drag: block dropping a collection into itself
        if (batch.collectionIds.includes(targetId)) {
          return;
        }
        const ids: string[] = [...batch.resourceIds, ...batch.collectionIds];
        setMovingIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            next.add(id);
          }
          return next;
        });

        const ops: Promise<unknown>[] = [];
        if (batch.resourceIds.length > 0) {
          ops.push(
            moveManyToCollection({
              workspaceId,
              resourceIds: batch.resourceIds,
              collectionId: targetId,
            })
          );
        }
        if (batch.collectionIds.length > 0) {
          ops.push(
            moveManyCollections({
              workspaceId,
              collectionIds: batch.collectionIds,
              newParentId: targetId,
            })
          );
        }
        void Promise.all(ops).finally(() => {
          clear();
        });
        return;
      }

      if (active.type === "collection" && active.collectionId === targetId) {
        return;
      }

      const itemId =
        active.type === "resource" ? active.resourceId : active.collectionId;

      setMovingIds((prev) => new Set(prev).add(itemId));

      if (active.type === "resource") {
        moveToCollection({
          workspaceId,
          resourceId: active.resourceId,
          collectionId: targetId,
        });
      } else {
        moveCollection({
          workspaceId,
          collectionId: active.collectionId,
          newParentId: targetId,
        });
      }
    },
    [
      workspaceId,
      moveToCollection,
      moveCollection,
      moveManyToCollection,
      moveManyCollections,
      clear,
    ]
  );

  const activeItemRef = useRef<ActiveDragItem | null>(null);
  activeItemRef.current = activeItem;

  const onDragCancel = useCallback(() => {
    setActiveItem(null);
  }, []);

  const clearMovingIds = useCallback((ids: string[]) => {
    setMovingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, []);

  return {
    sensors,
    activeItem,
    movingIds,
    clearMovingIds,
    onDragStart,
    onDragEnd,
    onDragCancel,
  };
}

import { useConvexMutation } from "@convex-dev/react-query";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

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

export interface DropTargetData {
  collectionId: Id<"collection">;
}

export function useLibraryDnd(workspaceId: Id<"workspace">) {
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(() => new Set());

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

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined;
    if (data) {
      setActiveItem(data);
    }
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);

      const active = event.active.data.current as DragItemData | undefined;
      const over = event.over?.data.current as DropTargetData | undefined;

      if (!(active && over)) {
        return;
      }

      if (
        active.type === "collection" &&
        active.collectionId === over.collectionId
      ) {
        return;
      }

      const itemId =
        active.type === "resource" ? active.resourceId : active.collectionId;

      setMovingIds((prev) => new Set(prev).add(itemId));

      if (active.type === "resource") {
        moveToCollection({
          workspaceId,
          resourceId: active.resourceId,
          collectionId: over.collectionId,
        });
      } else {
        moveCollection({
          workspaceId,
          collectionId: active.collectionId,
          newParentId: over.collectionId,
        });
      }
    },
    [workspaceId, moveToCollection, moveCollection]
  );

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

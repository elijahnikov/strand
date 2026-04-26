import { useConvexMutation } from "@convex-dev/react-query";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { toastManager } from "@omi/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { type Ref, useCallback } from "react";
import { CollectionIcon } from "~/components/common/collection-icon";
import { EditableText } from "~/components/common/editable-text";
import type { DragItemData, DropTargetData } from "./use-library-dnd";

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

interface CollectionRowProps {
  autoEdit?: boolean;
  collection: {
    _id: Id<"collection">;
    name: string;
    icon?: string | null;
    iconColor?: string | null;
    _creationTime: number;
  };
  onEdited?: () => void;
  workspaceId: Id<"workspace">;
}

export function CollectionRow({
  autoEdit,
  collection,
  onEdited,
  workspaceId,
}: CollectionRowProps) {
  const navigate = useNavigate();

  const { mutate: rename } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.rename),
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not rename collection",
        description: getErrorMessage(err),
      });
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.remove),
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not delete collection",
        description: getErrorMessage(err),
      });
    },
  });

  const dragData: DragItemData = {
    type: "collection",
    collectionId: collection._id,
    collection,
  };

  const dropData: DropTargetData = { collectionId: collection._id };

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: collection._id, data: dragData });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${collection._id}`,
    data: dropData,
  });

  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  const handleNavigate = () =>
    navigate({
      to: "/workspace/$workspaceId/library/collection/$collectionId",
      params: { workspaceId, collectionId: collection._id },
    });

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component",
        isDragging && "opacity-50",
        isOver && "bg-ui-bg-subtle-hover ring-2 ring-ui-fg-interactive"
      )}
      ref={mergedRef as Ref<HTMLDivElement>}
      {...listeners}
      {...attributes}
    >
      <Link
        className="absolute inset-0 z-10 rounded-lg"
        params={{ workspaceId, collectionId: collection._id }}
        preload="intent"
        tabIndex={-1}
        to="/workspace/$workspaceId/library/collection/$collectionId"
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        <CollectionIcon
          icon={collection.icon ?? undefined}
          iconColor={collection.iconColor ?? undefined}
          size="sm"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditableText
          autoEdit={autoEdit}
          className="font-medium text-sm text-ui-fg-base"
          onCancel={onEdited}
          onClick={handleNavigate}
          onSave={(name) => {
            rename({ workspaceId, collectionId: collection._id, name });
            onEdited?.();
          }}
          value={collection.name}
        />
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base">
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              className="text-ui-fg-error"
              onClick={() =>
                remove({ workspaceId, collectionId: collection._id })
              }
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

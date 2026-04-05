import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { EditableText } from "~/components/common/editable-text";

interface CollectionRowProps {
  autoEdit?: boolean;
  collection: {
    _id: Id<"collection">;
    name: string;
    icon?: string | null;
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
  });

  const { mutate: remove } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.remove),
  });

  const handleNavigate = () =>
    navigate({
      to: "/workspace/$workspaceId/library/collection/$collectionId",
      params: { workspaceId, collectionId: collection._id },
    });

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle">
      <Link
        className="absolute inset-0 z-10 rounded-lg"
        params={{ workspaceId, collectionId: collection._id }}
        tabIndex={-1}
        to="/workspace/$workspaceId/library/collection/$collectionId"
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        {collection.icon ? (
          <span className="text-sm">{collection.icon}</span>
        ) : (
          <FolderIcon className="h-4 w-4" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditableText
          autoEdit={autoEdit}
          className="font-medium text-sm text-ui-fg-base"
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

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Separator } from "@strand/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderIcon } from "lucide-react";
import { EditableText } from "~/components/common/editable-text";

interface CollectionHeaderProps {
  collection: {
    _id: Id<"collection">;
    name: string;
    icon?: string | null;
    breadcrumbs: Array<{ _id: Id<"collection">; name: string }>;
  };
  workspaceId: Id<"workspace">;
}

export function CollectionHeader({
  collection,
  workspaceId,
}: CollectionHeaderProps) {
  const navigate = useNavigate();

  const { mutate: rename } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.rename),
  });

  const { mutate: remove } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.remove),
  });

  const handleRename = (name: string) => {
    rename({ workspaceId, collectionId: collection._id, name });
  };

  const _handleDelete = () => {
    remove({ workspaceId, collectionId: collection._id });
    navigate({
      to: "/workspace/$workspaceId/library",
      params: { workspaceId },
    });
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <nav className="flex items-center gap-1 text-ui-fg-muted text-xs">
        <Link
          className="font-mono transition-colors hover:text-ui-fg-base"
          params={{ workspaceId }}
          preload="intent"
          to="/workspace/$workspaceId/library"
        >
          Library
        </Link>
        {collection.breadcrumbs.map((crumb) => (
          <span className="flex items-center gap-1" key={crumb._id}>
            <Separator className="mx-2 h-3 rotate-30" orientation="vertical" />

            <Link
              className="font-mono transition-colors hover:text-ui-fg-base"
              params={{ workspaceId, collectionId: crumb._id }}
              preload="intent"
              to="/workspace/$workspaceId/library/collection/$collectionId"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <span className="text-lg">
          {collection.icon ?? (
            <FolderIcon className="h-5 w-5 text-ui-fg-muted" />
          )}
        </span>
        <EditableText
          className="font-semibold text-lg text-ui-fg-base"
          onSave={handleRename}
          value={collection.name}
        />
      </div>
    </div>
  );
}

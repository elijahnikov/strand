import type { Id } from "@strand/backend/_generated/dataModel.js";
import { FolderIcon } from "lucide-react";
import { EditableText } from "~/components/common/editable-text";
import { ResourceRowInner } from "./resource-row";
import type { DragItemData } from "./use-library-dnd";

// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op for static overlay
const noop = () => {};

export function LibraryDragOverlay({
  item,
  workspaceId,
}: {
  item: DragItemData;
  workspaceId: Id<"workspace">;
}) {
  return (
    <div className="rounded-lg border-[0.5px]">
      {item.type === "collection" ? (
        <CollectionOverlayRow collection={item.collection} />
      ) : (
        <ResourceRowInner
          isPinned={false}
          onTogglePin={noop}
          onUpdateTitle={noop}
          resource={
            item.resource as Parameters<typeof ResourceRowInner>[0]["resource"]
          }
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

function CollectionOverlayRow({
  collection,
}: {
  collection: {
    name: string;
    icon?: string | null;
  };
}) {
  return (
    <div className="group relative flex items-center gap-3 rounded-lg bg-ui-bg-base px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        {collection.icon ? (
          <span className="text-sm">{collection.icon}</span>
        ) : (
          <FolderIcon className="h-4 w-4" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditableText
          className="font-medium text-sm text-ui-fg-base"
          onClick={noop}
          onSave={noop}
          value={collection.name}
        />
      </div>
    </div>
  );
}

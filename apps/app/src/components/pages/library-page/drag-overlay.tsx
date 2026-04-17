import type { Id } from "@strand/backend/_generated/dataModel.js";
import { FolderIcon } from "lucide-react";
import { EditableText } from "~/components/common/editable-text";
import { ResourceRowInner } from "./resource-row";
import type { ActiveDragItem } from "./use-library-dnd";

const MAX_STACK_LAYERS = 4;

// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op for static overlay
const noop = () => {};

export function LibraryDragOverlay({
  item,
  workspaceId,
}: {
  item: ActiveDragItem;
  workspaceId: Id<"workspace">;
}) {
  const { data, batch } = item;
  const totalCount = batch
    ? batch.resourceIds.length + batch.collectionIds.length
    : 1;

  return (
    <div className="relative">
      {batch && totalCount > 1 ? (
        <>
          <div className="absolute -top-2 -right-2 z-30 flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-fg-interactive px-1.5 font-medium text-[11px] text-white">
            {totalCount}
          </div>
          {Array.from({ length: Math.min(totalCount - 1, MAX_STACK_LAYERS) })
            .map((_, i) => i + 1)
            .reverse()
            .map((depth) => (
              <div
                className="absolute top-0 right-0 left-0 rounded-lg border-[0.5px] bg-ui-bg-component"
                key={`stack-${depth}`}
                style={{
                  height: `calc(100% - ${depth * 4}px)`,
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.03})`,
                }}
              />
            ))}
        </>
      ) : null}
      <div className="relative rounded-lg border-[0.5px] bg-ui-bg-component">
        {data.type === "collection" ? (
          <CollectionOverlayRow collection={data.collection} />
        ) : (
          <ResourceRowInner
            isPinned={false}
            onTogglePin={noop}
            onUpdateTitle={noop}
            resource={
              data.resource as Parameters<
                typeof ResourceRowInner
              >[0]["resource"]
            }
            workspaceId={workspaceId}
          />
        )}
      </div>
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

import type { Id } from "@omi/backend/_generated/dataModel.js";
import { FolderIcon } from "lucide-react";
import { motion } from "motion/react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { NoteIcon, WebsiteIcon } from "./resource-row";
import type { ActiveDragItem } from "./use-library-dnd";

const MAX_STACK_LAYERS = 3;

interface ResourceLike {
  type?: "website" | "note" | "file";
  website?: { favicon?: string | null } | null;
  file?: { fileName?: string; mimeType?: string } | null;
  fileUrl?: string | null;
}

export function LibraryDragOverlay({
  item,
  workspaceId: _workspaceId,
}: {
  item: ActiveDragItem;
  workspaceId: Id<"workspace">;
}) {
  const { data, batch } = item;
  const totalCount = batch
    ? batch.resourceIds.length + batch.collectionIds.length
    : 1;
  const stackDepth = batch ? Math.min(totalCount - 1, MAX_STACK_LAYERS) : 0;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="pointer-events-none relative h-10 w-10"
      initial={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      {Array.from({ length: stackDepth })
        .map((_, i) => stackDepth - i)
        .map((depth) => (
          <div
            className="absolute inset-0 rounded-lg border-[0.5px] bg-ui-bg-component shadow-sm"
            key={`stack-${depth}`}
            style={{
              transform: `translate(${depth * 3}px, ${depth * 3}px) scale(${1 - depth * 0.04})`,
              opacity: 1 - depth * 0.2,
            }}
          />
        ))}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border-[0.5px] bg-ui-bg-component text-ui-fg-base shadow-sm">
        <OverlayIcon data={data} />
      </div>
      {batch && totalCount > 1 ? (
        <div className="absolute -top-1.5 -right-1.5 z-30 flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-fg-interactive px-1.5 font-medium text-[11px] text-white shadow-sm">
          {totalCount}
        </div>
      ) : null}
    </motion.div>
  );
}

function OverlayIcon({ data }: { data: ActiveDragItem["data"] }) {
  if (data.type === "collection") {
    if (data.collection.icon) {
      return (
        <span className="text-lg leading-none">{data.collection.icon}</span>
      );
    }
    return <FolderIcon className="h-4 w-4 text-ui-fg-muted" />;
  }

  const resource = data.resource as ResourceLike;

  if (resource.type === "website") {
    return <WebsiteIcon favicon={resource.website?.favicon} />;
  }
  if (resource.type === "note") {
    return (
      <span className="text-ui-fg-muted">
        <NoteIcon />
      </span>
    );
  }
  if (resource.type === "file") {
    const isImage = resource.file?.mimeType?.startsWith("image/");
    if (isImage && resource.fileUrl) {
      return (
        <img
          alt=""
          className="h-full w-full object-cover"
          height={40}
          src={resource.fileUrl}
          width={40}
        />
      );
    }
    return (
      <FileKindIcon
        fileName={resource.file?.fileName}
        mimeType={resource.file?.mimeType}
      />
    );
  }
  return <FolderIcon className="h-4 w-4 text-ui-fg-muted" />;
}

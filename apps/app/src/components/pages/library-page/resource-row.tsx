import { useDraggable } from "@dnd-kit/core";
import type { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { EditableText } from "~/components/common/editable-text";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { TextShimmer } from "~/components/common/text-shimmer";
import type { DragItemData } from "./use-library-dnd";

type Resource = FunctionReturnType<
  typeof api.resource.queries.list
>["page"][number];

interface ResourceRowProps {
  isPinned: boolean;
  onDelete?: (resourceId: Id<"resource">) => void;
  onPurge?: (resourceId: Id<"resource">) => void;
  onRestore?: (resourceId: Id<"resource">) => void;
  onTogglePin: (resourceId: Id<"resource">) => void;
  onUpdateTitle: (resourceId: Id<"resource">, title: string) => void;
  resource: Resource;
  snippet?: string;
  variant?: "library" | "trash";
  workspaceId: Id<"workspace">;
}

export function ResourceRow(props: ResourceRowProps) {
  const dragData: DragItemData = {
    type: "resource",
    resourceId: props.resource._id,
    resource: props.resource,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.resource._id,
    data: dragData,
  });

  return (
    <div
      className={cn(isDragging && "opacity-50")}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <ResourceRowInner {...props} />
    </div>
  );
}

export function ResourceRowInner(props: ResourceRowProps) {
  switch (props.resource.type) {
    case "website":
      return <WebsiteRow {...props} />;
    case "note":
      return <NoteRow {...props} />;
    case "file":
      return <FileRow {...props} />;
    default:
      return null;
  }
}

export function UploadingFileRow({ fileName }: { fileName: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <DotGridLoader />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TextShimmer className="block truncate font-medium text-sm">
          {fileName}
        </TextShimmer>
      </div>
    </div>
  );
}

function RowLink({
  workspaceId,
  resourceId,
}: {
  workspaceId: Id<"workspace">;
  resourceId: Id<"resource">;
}) {
  return (
    <Link
      className="absolute inset-0 z-10 rounded-lg"
      params={{ workspaceId, resourceId }}
      preload="intent"
      tabIndex={-1}
      to="/workspace/$workspaceId/resource/$resourceId"
    />
  );
}

function useResourceNavigate(
  workspaceId: Id<"workspace">,
  resourceId: Id<"resource">
) {
  const navigate = useNavigate();
  return () =>
    navigate({
      to: "/workspace/$workspaceId/resource/$resourceId",
      params: { workspaceId, resourceId },
    });
}

function WebsiteRow({
  resource,
  onUpdateTitle,
  onTogglePin,
  isPinned,
  workspaceId,
  variant,
  onDelete,
  onRestore,
  onPurge,
  snippet,
}: ResourceRowProps) {
  const website = "website" in resource ? resource.website : null;
  const isMetadataPending =
    !website ||
    website.metadataStatus === "pending" ||
    website.metadataStatus === "processing";

  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component">
      <RowLink resourceId={resource._id} workspaceId={workspaceId} />
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          !(isMetadataPending || website?.favicon) &&
            "bg-ui-bg-subtle text-ui-fg-muted"
        )}
      >
        <AnimatePresence mode="wait">
          {isMetadataPending ? (
            <motion.div
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="loader"
              transition={{ duration: 0.15 }}
            >
              <DotGridLoader />
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              initial={{ opacity: 0, scale: 0.5 }}
              key="icon"
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <WebsiteIcon favicon={website?.favicon} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {isMetadataPending ? (
            <motion.div
              className="w-full"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              key="shimmer"
            >
              <TextShimmer className="block truncate font-medium text-sm">
                {website?.url ?? resource.title}
              </TextShimmer>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
              initial={{ opacity: 0, y: 4 }}
              key="title"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <EditableText
                className="font-medium text-sm text-ui-fg-base"
                onClick={handleNavigate}
                onSave={(title) => onUpdateTitle(resource._id, title)}
                value={resource.title}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {snippet ? <SnippetLine html={snippet} /> : null}
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {website?.url && (
          <a
            className="flex h-7 w-7 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base"
            href={website.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        )}
        <RowDropdownMenu
          isPinned={isPinned}
          onDelete={onDelete}
          onPurge={onPurge}
          onRestore={onRestore}
          onTogglePin={onTogglePin}
          resource={resource}
          variant={variant}
        />
      </div>
    </div>
  );
}

function NoteRow({
  resource,
  onUpdateTitle,
  onTogglePin,
  isPinned,
  workspaceId,
  variant,
  onDelete,
  onRestore,
  onPurge,
  snippet,
}: ResourceRowProps) {
  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component">
      <RowLink resourceId={resource._id} workspaceId={workspaceId} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        <NoteIcon />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditableText
          className="font-medium text-sm text-ui-fg-base"
          onClick={handleNavigate}
          onSave={(title) => onUpdateTitle(resource._id, title)}
          value={resource.title}
        />
        {snippet ? <SnippetLine html={snippet} /> : null}
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <RowDropdownMenu
          isPinned={isPinned}
          onDelete={onDelete}
          onPurge={onPurge}
          onRestore={onRestore}
          onTogglePin={onTogglePin}
          resource={resource}
          variant={variant}
        />
      </div>
    </div>
  );
}

function FileRow({
  resource,
  onUpdateTitle,
  onTogglePin,
  isPinned,
  workspaceId,
  variant,
  onDelete,
  onRestore,
  onPurge,
  snippet,
}: ResourceRowProps) {
  const file = "file" in resource ? resource.file : null;
  const fileUrl = "fileUrl" in resource ? resource.fileUrl : null;
  const isImage = file?.mimeType?.startsWith("image/");
  const aiStatus = "aiStatus" in resource ? resource.aiStatus : null;
  const isProcessing = aiStatus === "pending" || aiStatus === "processing";

  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component">
      <RowLink resourceId={resource._id} workspaceId={workspaceId} />
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md",
          !isProcessing && "bg-ui-bg-subtle"
        )}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="loader"
              transition={{ duration: 0.15 }}
            >
              <DotGridLoader />
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full w-full items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              key="icon"
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              {isImage && fileUrl ? (
                <img
                  alt={file?.fileName ?? ""}
                  className="h-full w-full object-cover"
                  height={32}
                  src={fileUrl}
                  width={32}
                />
              ) : (
                <FileKindIcon
                  fileName={file?.fileName}
                  mimeType={file?.mimeType}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              className="w-full"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              key="shimmer"
            >
              <TextShimmer className="block truncate font-medium text-sm">
                {file?.fileName ?? resource.title}
              </TextShimmer>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
              initial={{ opacity: 0, y: 4 }}
              key="title"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <EditableText
                className="font-medium text-sm text-ui-fg-base"
                onClick={handleNavigate}
                onSave={(title) => onUpdateTitle(resource._id, title)}
                value={resource.title}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {snippet ? <SnippetLine html={snippet} /> : null}
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {fileUrl && (
          <a
            className="flex h-7 w-7 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base"
            download={file?.fileName}
            href={fileUrl}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
          </a>
        )}
        <RowDropdownMenu
          isPinned={isPinned}
          onDelete={onDelete}
          onPurge={onPurge}
          onRestore={onRestore}
          onTogglePin={onTogglePin}
          resource={resource}
          variant={variant}
        />
      </div>
    </div>
  );
}

function RowDropdownMenu({
  resource,
  isPinned,
  onTogglePin,
  variant = "library",
  onDelete,
  onRestore,
  onPurge,
}: {
  isPinned: boolean;
  onDelete?: (resourceId: Id<"resource">) => void;
  onPurge?: (resourceId: Id<"resource">) => void;
  onRestore?: (resourceId: Id<"resource">) => void;
  onTogglePin: (resourceId: Id<"resource">) => void;
  resource: Resource;
  variant?: "library" | "trash";
}) {
  const website = "website" in resource ? resource.website : null;
  const fileUrl = "fileUrl" in resource ? resource.fileUrl : null;
  const file = "file" in resource ? resource.file : null;

  if (variant === "trash") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base">
          <MoreHorizontalIcon className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem onClick={() => onRestore?.(resource._id)}>
            <RotateCcwIcon className="h-4 w-4" />
            Restore
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-ui-fg-error"
            onClick={() => onPurge?.(resource._id)}
          >
            <TrashIcon className="h-4 w-4 text-ui-fg-error! group-hover/menuitem:text-ui-fg-base!" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base">
        <MoreHorizontalIcon className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem>
          <StarIcon className="h-4 w-4" />
          Favorite
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTogglePin(resource._id)}>
          {isPinned ? (
            <PinOffIcon className="h-4 w-4" />
          ) : (
            <PinIcon className="h-4 w-4" />
          )}
          {isPinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        {resource.type === "website" && website?.url && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.open(website.url, "_blank", "noopener")}
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Open in browser
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(website.url)}
            >
              <CopyIcon className="h-4 w-4" />
              Copy URL
            </DropdownMenuItem>
          </>
        )}
        {resource.type === "file" && fileUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const a = document.createElement("a");
                a.href = fileUrl as string;
                a.download = file?.fileName ?? "download";
                a.click();
              }}
            >
              <DownloadIcon className="h-4 w-4" />
              Download
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-ui-fg-error"
          onClick={() => onDelete?.(resource._id)}
        >
          <TrashIcon className="h-4 w-4 text-ui-fg-error! group-hover/menuitem:text-ui-fg-base!" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SnippetLine({ html }: { html: string }) {
  return (
    <div
      className="mt-0.5 line-clamp-2 text-ui-fg-subtle text-xs leading-relaxed [&_mark]:rounded-sm [&_mark]:bg-ui-tag-orange-bg [&_mark]:px-0.5 [&_mark]:text-ui-tag-orange-text"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-escaped <mark> highlighting
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function WebsiteIcon({ favicon }: { favicon?: string | null }) {
  if (favicon) {
    return (
      <img
        alt=""
        className="h-6 w-6 shrink-0 rounded-sm"
        height={16}
        src={favicon}
        width={16}
      />
    );
  }
  return <GlobeIcon />;
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-ui-fg-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21a9 9 0 100-18 9 9 0 000 18z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 014 9 15 15 0 01-4 9 15 15 0 01-4-9 15 15 0 014-9z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NoteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

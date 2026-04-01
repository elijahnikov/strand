import type { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PinIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EditableText } from "~/components/common/editable-text";
import { TextShimmer } from "~/components/common/text-shimmer";
import { getFileLabel } from "~/lib/format";

type Resource = FunctionReturnType<
  typeof api.resource.queries.list
>["page"][number];

interface ResourceRowProps {
  onUpdateTitle: (resourceId: Id<"resource">, title: string) => void;
  resource: Resource;
  workspaceId: Id<"workspace">;
}

function usePendingTitle(serverTitle: string) {
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);

  useEffect(() => {
    if (pendingTitle && serverTitle === pendingTitle) {
      setPendingTitle(null);
    }
  }, [serverTitle, pendingTitle]);

  return { pendingTitle, setPendingTitle };
}

export function ResourceRow({
  resource,
  onUpdateTitle,
  workspaceId,
}: ResourceRowProps) {
  switch (resource.type) {
    case "website":
      return (
        <WebsiteRow
          onUpdateTitle={onUpdateTitle}
          resource={resource}
          workspaceId={workspaceId}
        />
      );
    case "note":
      return (
        <NoteRow
          onUpdateTitle={onUpdateTitle}
          resource={resource}
          workspaceId={workspaceId}
        />
      );
    case "file":
      return (
        <FileRow
          onUpdateTitle={onUpdateTitle}
          resource={resource}
          workspaceId={workspaceId}
        />
      );
    default:
      return null;
  }
}

export function UploadingFileRow({ fileName }: { fileName: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TextShimmer className="truncate font-medium text-sm">
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
  workspaceId,
}: ResourceRowProps) {
  const website = "website" in resource ? resource.website : null;
  const isMetadataPending =
    !website ||
    website.metadataStatus === "pending" ||
    website.metadataStatus === "processing";

  const { pendingTitle, setPendingTitle } = usePendingTitle(resource.title);
  const isTitlePending = pendingTitle !== null;
  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  const handleSave = (title: string) => {
    setPendingTitle(title);
    onUpdateTitle(resource._id, title);
  };

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle">
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
          {isMetadataPending || isTitlePending ? (
            <motion.div
              className="w-full"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              key="shimmer"
            >
              <TextShimmer className="truncate font-medium text-sm">
                {pendingTitle ?? website?.url ?? resource.title}
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
                onSave={handleSave}
                value={resource.title}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
        <RowDropdownMenu resource={resource} />
      </div>
    </div>
  );
}

function NoteRow({ resource, onUpdateTitle, workspaceId }: ResourceRowProps) {
  const { pendingTitle, setPendingTitle } = usePendingTitle(resource.title);
  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  const handleSave = (title: string) => {
    setPendingTitle(title);
    onUpdateTitle(resource._id, title);
  };

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle">
      <RowLink resourceId={resource._id} workspaceId={workspaceId} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        <NoteIcon />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {pendingTitle === null ? (
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
                onSave={handleSave}
                value={resource.title}
              />
            </motion.div>
          ) : (
            <motion.div
              className="w-full"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              key="shimmer"
            >
              <TextShimmer className="truncate font-medium text-sm">
                {pendingTitle}
              </TextShimmer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative z-20 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <RowDropdownMenu resource={resource} />
      </div>
    </div>
  );
}

function FileRow({ resource, onUpdateTitle, workspaceId }: ResourceRowProps) {
  const file = "file" in resource ? resource.file : null;
  const fileUrl = "fileUrl" in resource ? resource.fileUrl : null;
  const isImage = file?.mimeType?.startsWith("image/");

  const { pendingTitle, setPendingTitle } = usePendingTitle(resource.title);
  const handleNavigate = useResourceNavigate(workspaceId, resource._id);

  const handleSave = (title: string) => {
    setPendingTitle(title);
    onUpdateTitle(resource._id, title);
  };

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle">
      <RowLink resourceId={resource._id} workspaceId={workspaceId} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-ui-bg-subtle">
        {isImage && fileUrl ? (
          <img
            alt={file?.fileName ?? ""}
            className="h-full w-full object-cover"
            height={32}
            src={fileUrl}
            width={32}
          />
        ) : (
          <span className="font-semibold text-[10px] text-ui-fg-muted">
            {getFileLabel(file?.mimeType)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {pendingTitle === null ? (
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
                onSave={handleSave}
                value={resource.title}
              />
            </motion.div>
          ) : (
            <motion.div
              className="w-full"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              key="shimmer"
            >
              <TextShimmer className="truncate font-medium text-sm">
                {pendingTitle}
              </TextShimmer>
            </motion.div>
          )}
        </AnimatePresence>
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
        <RowDropdownMenu resource={resource} />
      </div>
    </div>
  );
}

function RowDropdownMenu({ resource }: { resource: Resource }) {
  const website = "website" in resource ? resource.website : null;
  const fileUrl = "fileUrl" in resource ? resource.fileUrl : null;
  const file = "file" in resource ? resource.file : null;

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
        <DropdownMenuItem>
          <PinIcon className="h-4 w-4" />
          Pin
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
        <DropdownMenuItem className="text-ui-fg-error">
          <TrashIcon className="h-4 w-4 text-ui-fg-error! group-hover/menuitem:text-ui-fg-base!" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Dot Grid Loader ---

const DOT_ORBIT_ORDER = [0, 1, 3, 5, 4, 2] as const;

function DotGridLoader() {
  return (
    <>
      <style>{`
        @keyframes dot-orbit {
          0%, 100% { opacity: 1; }
          16.67%, 83.33% { opacity: 0.2; }
        }
      `}</style>
      <div className="grid h-3.5 w-2.5 grid-cols-2 grid-rows-3 gap-[0.5px]">
        {Array.from({ length: 6 }).map((_, i) => {
          const orbitIndex = DOT_ORBIT_ORDER.indexOf(
            i as 0 | 1 | 2 | 3 | 4 | 5
          );
          return (
            <span
              className="h-0.75 w-0.75 rounded-full bg-ui-fg-subtle"
              key={`dot-${i.toString()}`}
              style={{
                opacity: 0.2,
                animation: "dot-orbit 1.2s ease-in-out infinite",
                animationDelay: `${orbitIndex * 0.2}s`,
              }}
            />
          );
        })}
      </div>
    </>
  );
}

function WebsiteIcon({ favicon }: { favicon?: string | null }) {
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

function NoteIcon() {
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

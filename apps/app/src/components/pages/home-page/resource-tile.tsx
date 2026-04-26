import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Link } from "@tanstack/react-router";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import {
  NoteIcon,
  WebsiteIcon,
} from "~/components/pages/library-page/resource-row";

export interface ResourcePreview {
  domain?: string | null;
  favicon?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  ogImage?: string | null;
  plainTextSnippet?: string | null;
  summary?: string | null;
}

export interface ResourceTileData {
  _id: Id<"resource">;
  preview: ResourcePreview;
  title: string;
  type: "website" | "note" | "file";
  updatedAt: number;
}

export function ResourceTile({
  workspaceId,
  resource,
  footer,
  className,
}: {
  workspaceId: Id<"workspace">;
  resource: ResourceTileData;
  footer?: React.ReactNode;
  className?: string;
}) {
  const snippet =
    resource.preview.summary ?? resource.preview.plainTextSnippet ?? null;

  return (
    <Link
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-lg border-[0.5px] bg-ui-bg-component p-3 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component",
        className
      )}
      params={{ workspaceId, resourceId: resource._id }}
      preload="intent"
      to="/workspace/$workspaceId/resource/$resourceId"
    >
      <div className="flex items-start gap-2.5">
        <ResourceTileIcon resource={resource} />
        <p className="line-clamp-2 flex-1 font-medium text-sm text-ui-fg-base">
          {resource.title}
        </p>
      </div>
      {snippet ? (
        <p className="line-clamp-3 text-ui-fg-subtle text-xs leading-relaxed">
          {snippet}
        </p>
      ) : null}
      {footer ? (
        <div className="mt-auto pt-1 text-ui-fg-muted text-xs">{footer}</div>
      ) : null}
    </Link>
  );
}

function ResourceTileIcon({ resource }: { resource: ResourceTileData }) {
  const isImage =
    resource.type === "file" &&
    resource.preview.mimeType?.startsWith("image/") &&
    resource.preview.fileUrl;

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md",
        !isImage && "bg-ui-bg-subtle text-ui-fg-muted"
      )}
    >
      {resource.type === "website" ? (
        <WebsiteIcon favicon={resource.preview.favicon} />
      ) : null}
      {resource.type === "note" ? <NoteIcon /> : null}
      {resource.type === "file" ? (
        isImage ? (
          <img
            alt=""
            className="size-full object-cover"
            height={32}
            src={resource.preview.fileUrl ?? ""}
            width={32}
          />
        ) : (
          <FileKindIcon
            fileName={resource.preview.fileName}
            mimeType={resource.preview.mimeType}
          />
        )
      ) : null}
    </div>
  );
}

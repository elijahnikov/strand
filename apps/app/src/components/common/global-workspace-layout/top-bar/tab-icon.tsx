import { convexQuery } from "@convex-dev/react-query";
import {
  RiChat1Line,
  RiFolder3Line,
  RiHashtag,
  RiStickyNoteLine,
} from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { getFileLabel } from "~/lib/format";
import type { WorkspaceTab } from "~/lib/workspace-tabs-store";

interface TabIconProps {
  tab: WorkspaceTab;
  workspaceId: string;
}

export function TabIcon({ tab, workspaceId }: TabIconProps) {
  if (tab.kind === "resource") {
    return (
      <ResourceTabIcon
        resourceId={tab.entityId as Id<"resource">}
        workspaceId={workspaceId as Id<"workspace">}
      />
    );
  }
  if (tab.kind === "collection") {
    return (
      <CollectionTabIcon
        collectionId={tab.entityId as Id<"collection">}
        workspaceId={workspaceId as Id<"workspace">}
      />
    );
  }
  if (tab.kind === "chat") {
    return <RiChat1Line className="size-3.5 text-ui-fg-muted" />;
  }
  return <RiHashtag className="size-3.5 text-ui-fg-muted" />;
}

function ResourceTabIcon({
  workspaceId,
  resourceId,
}: {
  workspaceId: Id<"workspace">;
  resourceId: Id<"resource">;
}) {
  const { data: resource } = useQuery(
    convexQuery(api.resource.queries.get, { workspaceId, resourceId })
  );

  if (!resource) {
    return <span className="size-3.5 rounded-[3px] bg-ui-bg-subtle" />;
  }

  if (resource.type === "website") {
    if (resource.website?.favicon) {
      return (
        <img
          alt=""
          className="size-3.5 shrink-0 rounded-[3px]"
          height={14}
          src={resource.website.favicon}
          width={14}
        />
      );
    }
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0 text-ui-fg-muted"
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

  if (resource.type === "note") {
    return <RiStickyNoteLine className="size-3.5 text-ui-fg-muted" />;
  }

  if (resource.type === "file") {
    if (resource.file?.mimeType?.startsWith("image/") && resource.fileUrl) {
      return (
        <img
          alt=""
          className="size-3.5 shrink-0 rounded-[2px] object-cover"
          height={14}
          src={resource.fileUrl}
          width={14}
        />
      );
    }
    return (
      <span className="flex h-3.5 shrink-0 items-center rounded-[2px] bg-ui-bg-subtle px-0.5 font-semibold text-[8px] text-ui-fg-muted leading-none">
        {getFileLabel(resource.file?.mimeType ?? undefined)}
      </span>
    );
  }

  return <span className="size-3.5 rounded-[3px] bg-ui-bg-subtle" />;
}

function CollectionTabIcon({
  workspaceId,
  collectionId,
}: {
  workspaceId: Id<"workspace">;
  collectionId: Id<"collection">;
}) {
  const { data: collection } = useQuery(
    convexQuery(api.collection.queries.get, { workspaceId, collectionId })
  );
  if (collection?.icon) {
    return <span className="text-[13px] leading-none">{collection.icon}</span>;
  }
  return <RiFolder3Line className="size-3.5 text-ui-fg-muted" />;
}

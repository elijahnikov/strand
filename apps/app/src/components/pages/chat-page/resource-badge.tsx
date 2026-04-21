import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Skeleton } from "@omi/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { FileKindIcon } from "~/components/common/file-kind-icon";

function WebsiteIcon({ favicon }: { favicon?: string | null }) {
  if (favicon) {
    return (
      <img
        alt=""
        className="size-3.5 shrink-0 rounded-[3px] object-cover"
        height={14}
        src={favicon}
        width={14}
      />
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0 text-muted-foreground"
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
      className="size-3.5 shrink-0 text-muted-foreground"
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

export function ResourceIcon({
  type,
  favicon,
  fileUrl,
  mimeType,
}: {
  type: string;
  favicon?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
}) {
  switch (type) {
    case "website":
      return <WebsiteIcon favicon={favicon} />;
    case "note":
      return <NoteIcon />;
    case "file":
      if (mimeType?.startsWith("image/") && fileUrl) {
        return (
          <img
            alt=""
            className="size-3.5 shrink-0 rounded-[2px] object-cover"
            height={14}
            src={fileUrl}
            width={14}
          />
        );
      }
      return <FileKindIcon className="size-3.5 shrink-0" mimeType={mimeType} />;
    default:
      return <WebsiteIcon favicon={null} />;
  }
}

export function ResourceBadge({
  resourceId,
  title,
  type,
}: {
  resourceId: string;
  title: string;
  type: string;
}) {
  const { workspaceId } = useParams({ strict: false });

  const { data: resource, isLoading } = useQuery(
    convexQuery(api.resource.queries.getPreview, {
      resourceId: resourceId as Id<"resource">,
      workspaceId: workspaceId as Id<"workspace">,
    })
  );

  if (isLoading) {
    return (
      <span className="inline-flex -translate-y-[2px] align-middle">
        <Skeleton className="h-5 w-24 rounded-sm sm:h-4" />
      </span>
    );
  }

  const displayTitle = resource?.title ?? title;
  const displayType = resource?.type ?? type;

  return (
    <Link
      className="inline-flex max-w-full -translate-y-[2px] align-middle"
      params={{
        workspaceId: workspaceId as string,
        resourceId,
      }}
      to="/workspace/$workspaceId/resource/$resourceId"
    >
      <Badge className="max-w-full" variant={"mono"}>
        <ResourceIcon
          favicon={resource?.preview?.favicon}
          fileUrl={resource?.preview?.fileUrl}
          mimeType={resource?.preview?.mimeType}
          type={displayType}
        />
        <span className="min-w-0 truncate font-medium font-mono text-xs">
          {displayTitle}
        </span>
      </Badge>
    </Link>
  );
}

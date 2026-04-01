import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Separator } from "@strand/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { getFileLabel } from "~/lib/format";

const PAGE_LABELS: Record<string, string> = {
  library: "Library",
  search: "Search",
  settings: "Settings",
};

function BreadcrumbSeparator() {
  return (
    <Separator className="my-3 mr-3 ml-3 rotate-30" orientation="vertical" />
  );
}

export function Breadcrumbs() {
  const params = useParams({ strict: false }) as {
    resourceId?: string;
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (l) => l.pathname });

  if (!params?.workspaceId) {
    return null;
  }

  const segments =
    pathname
      .split(`/workspace/${params.workspaceId}`)[1]
      ?.split("/")
      .filter(Boolean) ?? [];

  const currentPage = segments[0];
  if (!currentPage) {
    return null;
  }

  if (currentPage === "resource") {
    return params.resourceId ? (
      <ResourceBreadcrumbs
        resourceId={params.resourceId as Id<"resource">}
        workspaceId={params.workspaceId as Id<"workspace">}
      />
    ) : (
      <ResourceBreadcrumbsSkeleton
        workspaceId={params.workspaceId as Id<"workspace">}
      />
    );
  }

  return (
    <>
      <BreadcrumbSeparator />
      <span className="txt-small font-medium text-ui-fg-base">
        {PAGE_LABELS[currentPage] ?? currentPage}
      </span>
    </>
  );
}

function BreadcrumbTitleSkeleton() {
  return (
    <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-ui-bg-subtle" />
  );
}

function ResourceBreadcrumbsSkeleton({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId }}
        to="/workspace/$workspaceId/library"
      >
        Library
      </Link>
      <BreadcrumbSeparator />
      <BreadcrumbTitleSkeleton />
    </>
  );
}

function ResourceBreadcrumbs({
  workspaceId,
  resourceId,
}: {
  workspaceId: Id<"workspace">;
  resourceId: Id<"resource">;
}) {
  const { data: resource, isLoading } = useQuery(
    convexQuery(api.resource.queries.get, { workspaceId, resourceId })
  );

  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId }}
        to="/workspace/$workspaceId/library"
      >
        Library
      </Link>
      <BreadcrumbSeparator />
      {isLoading || !resource ? (
        <BreadcrumbTitleSkeleton />
      ) : (
        <span className="flex max-w-48 items-center gap-1.5">
          <ResourceIcon resource={resource} />
          <span className="txt-small truncate font-medium text-ui-fg-base">
            {resource.title}
          </span>
        </span>
      )}
    </>
  );
}

function ResourceIcon({
  resource,
}: {
  resource: {
    type: string;
    website?: { favicon?: string | null } | null;
    file?: { mimeType?: string | null } | null;
    fileUrl?: string | null;
  };
}) {
  switch (resource.type) {
    case "website":
      return <WebsiteIcon favicon={resource.website?.favicon} />;
    case "note":
      return <NoteIcon />;
    case "file":
      if (resource.file?.mimeType?.startsWith("image/") && resource.fileUrl) {
        return (
          <img
            alt=""
            className="h-3.5 w-3.5 shrink-0 rounded-[2px] object-cover"
            height={14}
            src={resource.fileUrl}
            width={14}
          />
        );
      }
      return <FileLabel mimeType={resource.file?.mimeType} />;
    default:
      return null;
  }
}

function WebsiteIcon({ favicon }: { favicon?: string | null }) {
  if (favicon) {
    return (
      <img
        alt=""
        className="h-3.5 w-3.5 shrink-0 rounded-[4px]"
        height={14}
        src={favicon}
        width={14}
      />
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-ui-fg-muted"
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
      className="h-3.5 w-3.5 shrink-0 text-ui-fg-muted"
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

function FileLabel({ mimeType }: { mimeType?: string | null }) {
  return (
    <span className="flex h-3.5 shrink-0 items-center rounded-[2px] bg-ui-bg-subtle px-0.5 font-semibold text-[8px] text-ui-fg-muted leading-none">
      {getFileLabel(mimeType ?? undefined)}
    </span>
  );
}

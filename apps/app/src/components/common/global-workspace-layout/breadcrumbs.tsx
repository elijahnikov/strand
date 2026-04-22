import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Separator } from "@omi/ui/separator";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { Fragment } from "react";
import { CollectionIcon } from "~/components/common/collection-icon";
import { FileKindIcon } from "~/components/common/file-kind-icon";

const PAGE_LABELS: Record<string, string> = {
  library: "Library",
  search: "Search",
  settings: "Settings",
  tags: "Tags",
  chat: "Chat",
};

interface BreadcrumbParams {
  collectionId?: string;
  resourceId?: string;
  tagName?: string;
  workspaceId?: string;
}

function BreadcrumbSeparator() {
  return (
    <Separator className="my-3 mr-3 ml-3 rotate-30" orientation="vertical" />
  );
}

export function Breadcrumbs() {
  const params = useParams({ strict: false }) as BreadcrumbParams;
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

  if (currentPage === "chat" && segments[1]) {
    return (
      <ChatThreadBreadcrumbs
        threadId={segments[1] as Id<"chatThread">}
        workspaceId={params.workspaceId as Id<"workspace">}
      />
    );
  }

  if (currentPage === "tags" && params.tagName) {
    return (
      <TagBreadcrumbs
        tagName={params.tagName}
        workspaceId={params.workspaceId as string}
      />
    );
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

  if (
    currentPage === "library" &&
    segments[1] === "collection" &&
    params.collectionId
  ) {
    return (
      <CollectionBreadcrumbs
        collectionId={params.collectionId as Id<"collection">}
        workspaceId={params.workspaceId as Id<"workspace">}
      />
    );
  }

  return (
    <>
      <BreadcrumbSeparator />
      <Text className="txt-small font-medium text-ui-fg-base">
        {PAGE_LABELS[currentPage] ?? currentPage}
      </Text>
    </>
  );
}

function BreadcrumbTitleSkeleton() {
  return (
    <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-ui-bg-subtle" />
  );
}

function TagBreadcrumbs({
  tagName,
  workspaceId,
}: {
  tagName: string;
  workspaceId: string;
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId }}
        preload="intent"
        to="/workspace/$workspaceId/tags"
      >
        Tags
      </Link>
      <BreadcrumbSeparator />
      <span className="txt-small font-medium text-ui-fg-base">
        <span className="text-ui-fg-muted">#</span>
        {tagName}
      </span>
    </>
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
        preload="intent"
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
        preload="intent"
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
    file?: { fileName?: string | null; mimeType?: string | null } | null;
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
      return (
        <FileKindIcon
          className="size-3.5 shrink-0"
          fileName={resource.file?.fileName}
          mimeType={resource.file?.mimeType}
        />
      );
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

function ChatThreadBreadcrumbs({
  workspaceId,
  threadId,
}: {
  workspaceId: Id<"workspace">;
  threadId: Id<"chatThread">;
}) {
  const { data: thread, isLoading } = useQuery(
    convexQuery(api.chat.queries.getThread, { workspaceId, threadId })
  );

  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId }}
        preload="intent"
        to="/workspace/$workspaceId/chat"
      >
        Chat
      </Link>
      <BreadcrumbSeparator />
      {isLoading || !thread ? (
        <BreadcrumbTitleSkeleton />
      ) : (
        <span className="txt-small max-w-48 truncate font-medium text-ui-fg-base">
          {thread.title ?? "New chat"}
        </span>
      )}
    </>
  );
}

function CollectionBreadcrumbs({
  workspaceId,
  collectionId,
}: {
  workspaceId: Id<"workspace">;
  collectionId: Id<"collection">;
}) {
  const { data: collection, isLoading } = useQuery(
    convexQuery(api.collection.queries.get, { workspaceId, collectionId })
  );
  const navigate = useNavigate();

  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId }}
        preload="intent"
        to="/workspace/$workspaceId/library"
      >
        Library
      </Link>
      {isLoading || !collection ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbTitleSkeleton />
        </>
      ) : (
        <>
          <TruncatedBreadcrumbs
            crumbs={collection.breadcrumbs}
            navigate={navigate}
            workspaceId={workspaceId}
          />
          <BreadcrumbSeparator />
          <span className="txt-small inline-flex items-center gap-1 truncate font-medium text-ui-fg-base">
            <CollectionIcon
              icon={collection.icon ?? undefined}
              iconColor={collection.iconColor ?? undefined}
              size="xs"
            />
            {collection.name}
          </span>
        </>
      )}
    </>
  );
}

const MAX_VISIBLE_CRUMBS = 2;

function TruncatedBreadcrumbs({
  crumbs,
  workspaceId,
  navigate,
}: {
  crumbs: Array<{ _id: Id<"collection">; name: string }>;
  workspaceId: Id<"workspace">;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (crumbs.length <= MAX_VISIBLE_CRUMBS) {
    return (
      <>
        {crumbs.map((crumb) => (
          <Fragment key={crumb._id}>
            <BreadcrumbSeparator />
            <Link
              className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
              params={{ workspaceId, collectionId: crumb._id }}
              preload="intent"
              to="/workspace/$workspaceId/library/collection/$collectionId"
            >
              {crumb.name}
            </Link>
          </Fragment>
        ))}
      </>
    );
  }

  const first = crumbs[0] as (typeof crumbs)[number];
  const hidden = crumbs.slice(1, -1);
  const last = crumbs.at(-1) as (typeof crumbs)[number];

  return (
    <>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId, collectionId: first._id }}
        preload="intent"
        to="/workspace/$workspaceId/library/collection/$collectionId"
      >
        {first.name}
      </Link>
      <BreadcrumbSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-5 w-5 items-center justify-center rounded text-ui-fg-muted transition-colors hover:bg-ui-bg-subtle hover:text-ui-fg-base">
          <EllipsisIcon className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          {hidden.map((crumb) => (
            <DropdownMenuItem
              key={crumb._id}
              onClick={() =>
                navigate({
                  to: "/workspace/$workspaceId/library/collection/$collectionId",
                  params: { workspaceId, collectionId: crumb._id },
                })
              }
            >
              {crumb.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <BreadcrumbSeparator />
      <Link
        className="txt-small font-medium text-ui-fg-muted transition-colors hover:text-ui-fg-base"
        params={{ workspaceId, collectionId: last._id }}
        preload="intent"
        to="/workspace/$workspaceId/library/collection/$collectionId"
      >
        {last.name}
      </Link>
    </>
  );
}

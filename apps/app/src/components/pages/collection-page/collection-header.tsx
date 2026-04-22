import { useConvexMutation } from "@convex-dev/react-query";
import { useDroppable } from "@dnd-kit/core";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Badge } from "@omi/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Separator } from "@omi/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { CollectionIcon } from "~/components/common/collection-icon";
import { EditableText } from "~/components/common/editable-text";
import { WorkspaceIconSelector } from "~/components/common/workspace-icon";
import type { DropTargetData } from "../library-page/use-library-dnd";

interface CollectionHeaderProps {
  collection: {
    _id: Id<"collection">;
    name: string;
    icon?: string | null;
    iconColor?: string | null;
    breadcrumbs: Array<{
      _id: Id<"collection">;
      name: string;
      icon?: string | null;
      iconColor?: string | null;
    }>;
  };
  workspaceId: Id<"workspace">;
}

export function CollectionHeader({
  collection,
  workspaceId,
}: CollectionHeaderProps) {
  const navigate = useNavigate();

  const { mutate: rename } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.rename),
  });

  const { mutate: updateIcon } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.updateIcon),
  });

  const handleRename = (name: string) => {
    rename({ workspaceId, collectionId: collection._id, name });
  };

  const currentEmoji =
    collection.icon && !collection.iconColor ? collection.icon : undefined;
  const currentIconName =
    collection.icon && collection.iconColor ? collection.icon : undefined;

  return (
    <div className="mb-4 flex flex-col gap-2">
      <nav className="flex items-center gap-1 text-ui-fg-muted text-xs">
        <Link
          className="font-mono tracking-normal transition-colors hover:text-ui-fg-base"
          params={{ workspaceId }}
          preload="intent"
          to="/workspace/$workspaceId/library"
        >
          <DroppableBadge dropId="breadcrumb-root">Library</DroppableBadge>
        </Link>
        <HeaderBreadcrumbs
          crumbs={collection.breadcrumbs}
          navigate={navigate}
          workspaceId={workspaceId}
        />
      </nav>
      <div className="mt-2 flex items-center gap-2">
        <WorkspaceIconSelector
          currentEmoji={currentEmoji}
          currentIcon={currentIconName}
          currentIconColor={collection.iconColor ?? undefined}
          onSelect={(value) => {
            if (value.type === "emoji") {
              updateIcon({
                workspaceId,
                collectionId: collection._id,
                icon: value.emoji,
                iconColor: undefined,
              });
            } else {
              updateIcon({
                workspaceId,
                collectionId: collection._id,
                icon: value.name,
                iconColor: value.color,
              });
            }
          }}
        >
          <CollectionIcon
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-ui-bg-subtle-hover"
            icon={collection.icon ?? undefined}
            iconColor={collection.iconColor ?? undefined}
            size="xl"
          />
        </WorkspaceIconSelector>
        <EditableText
          className="font-medium text-lg text-ui-fg-base"
          onSave={handleRename}
          value={collection.name}
        />
      </div>
    </div>
  );
}

const MAX_VISIBLE_CRUMBS = 2;

interface BreadcrumbCrumb {
  _id: Id<"collection">;
  icon?: string | null;
  iconColor?: string | null;
  name: string;
}

function CrumbBadge({ crumb }: { crumb: BreadcrumbCrumb }) {
  return (
    <DroppableBadge collectionId={crumb._id} dropId={`breadcrumb-${crumb._id}`}>
      <span className="inline-flex items-center gap-1">
        <CollectionIcon
          icon={crumb.icon ?? undefined}
          iconColor={crumb.iconColor ?? undefined}
          size="xs"
        />
        {crumb.name}
      </span>
    </DroppableBadge>
  );
}

function HeaderBreadcrumbs({
  crumbs,
  workspaceId,
  navigate,
}: {
  crumbs: BreadcrumbCrumb[];
  workspaceId: Id<"workspace">;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (crumbs.length <= MAX_VISIBLE_CRUMBS) {
    return (
      <>
        {crumbs.map((crumb) => (
          <Fragment key={crumb._id}>
            <Separator className="mx-2 h-3 rotate-30" orientation="vertical" />
            <Link
              className="font-mono tracking-normal transition-colors hover:text-ui-fg-base"
              params={{ workspaceId, collectionId: crumb._id }}
              preload="intent"
              to="/workspace/$workspaceId/library/collection/$collectionId"
            >
              <CrumbBadge crumb={crumb} />
            </Link>
          </Fragment>
        ))}
      </>
    );
  }

  const first = crumbs[0] as BreadcrumbCrumb;
  const hidden = crumbs.slice(1, -1);
  const last = crumbs.at(-1) as BreadcrumbCrumb;

  return (
    <>
      <Separator className="mx-2 h-3 rotate-30" orientation="vertical" />
      <Link
        className="font-mono transition-colors hover:text-ui-fg-base"
        params={{ workspaceId, collectionId: first._id }}
        preload="intent"
        to="/workspace/$workspaceId/library/collection/$collectionId"
      >
        <CrumbBadge crumb={first} />
      </Link>
      <Separator className="mx-2 h-3 rotate-30" orientation="vertical" />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-5 w-5 items-center justify-center rounded text-ui-fg-muted transition-colors hover:bg-ui-bg-subtle hover:text-ui-fg-base">
          <EllipsisIcon className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          {hidden.map((crumb) => (
            <DropdownMenuItem
              className="gap-1.5"
              key={crumb._id}
              onClick={() =>
                navigate({
                  to: "/workspace/$workspaceId/library/collection/$collectionId",
                  params: { workspaceId, collectionId: crumb._id },
                })
              }
            >
              <CollectionIcon
                icon={crumb.icon ?? undefined}
                iconColor={crumb.iconColor ?? undefined}
                size="xs"
              />
              {crumb.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator className="mx-2 h-3 rotate-30" orientation="vertical" />
      <Link
        className="font-mono transition-colors hover:text-ui-fg-base"
        params={{ workspaceId, collectionId: last._id }}
        preload="intent"
        to="/workspace/$workspaceId/library/collection/$collectionId"
      >
        <CrumbBadge crumb={last} />
      </Link>
    </>
  );
}

function DroppableBadge({
  children,
  collectionId,
  dropId,
}: {
  children: ReactNode;
  collectionId?: Id<"collection">;
  dropId: string;
}) {
  const data: DropTargetData = { collectionId };
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data });

  return (
    <Badge
      className={cn(
        "h-5.5! min-h-5.5! py-0.5! text-[12px]! text-ui-fg-base transition-[box-shadow,background-color] duration-150",
        isOver &&
          "bg-ui-bg-subtle-hover ring-2 ring-ui-fg-interactive ring-offset-1 ring-offset-ui-bg-base"
      )}
      ref={setNodeRef}
      size="sm"
      variant={"mono"}
    >
      {children}
    </Badge>
  );
}

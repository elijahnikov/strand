import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Doc, Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { useQuery } from "@tanstack/react-query";
import type { UseNavigateResult } from "@tanstack/react-router";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { WorkspaceIcon } from "~/components/common/workspace-icon";

type Workspace = Doc<"workspace"> & { role: string };

function WorkspaceItem({
  workspace,
  isActive,
  onSelect,
}: {
  workspace: Workspace;
  isActive: boolean;
  onSelect: UseNavigateResult<string>;
}) {
  return (
    <DropdownMenuItem
      className={isActive ? "bg-ui-bg-component-hover" : ""}
      onClick={() =>
        onSelect({
          to: "/workspace/$workspaceId",
          params: { workspaceId: workspace._id as Id<"workspace"> },
        })
      }
    >
      <WorkspaceIcon
        emoji={workspace.emoji}
        icon={workspace.icon}
        iconColor={workspace.iconColor}
        size="xs"
      />
      <span className={cn("truncate", isActive && "text-ui-fg-base")}>
        {workspace.name}
      </span>
    </DropdownMenuItem>
  );
}

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const { data: workspaces, isLoading } = useQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );

  if (isLoading) {
    return <WorkspaceSwitcherSkeleton />;
  }

  const current = workspaces?.find((w) => w._id === workspaceId);
  const owned = workspaces?.filter((w) => w.role === "owner") ?? [];
  const memberOf = workspaces?.filter((w) => w.role !== "owner") ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="h-7 gap-x-1 rounded-full border-[0.5px] bg-[rgba(0,0,0,0.070)] pl-1.5 hover:bg-[rgba(0,0,0,0.090)] dark:bg-[rgba(255,255,255,0.070)] hover:dark:bg-[rgba(255,255,255,0.090)]"
            size="small"
            variant="ghost"
          />
        }
      >
        <WorkspaceIcon
          emoji={current?.emoji}
          icon={current?.icon}
          iconColor={current?.iconColor}
          size="sm"
        />
        <Text size="small" weight={"plus"}>
          {current?.name}
        </Text>
        <ChevronsUpDownIcon className="ml-1 size-3 stroke-[2.25px] text-ui-fg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="-mt-0.75 w-56 max-w-56 overflow-x-hidden"
        side="bottom"
        sideOffset={9}
      >
        {owned.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
            {owned.map((workspace) => (
              <WorkspaceItem
                isActive={workspace._id === workspaceId}
                key={workspace._id}
                onSelect={navigate}
                workspace={workspace}
              />
            ))}
          </DropdownMenuGroup>
        )}
        {owned.length > 0 && memberOf.length > 0 && <DropdownMenuSeparator />}
        {memberOf.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Shared with you</DropdownMenuLabel>
            {memberOf.map((workspace) => (
              <WorkspaceItem
                isActive={workspace._id === workspaceId}
                key={workspace._id}
                onSelect={navigate}
                workspace={workspace}
              />
            ))}
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <PlusIcon />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceSwitcherSkeleton() {
  return (
    <div className="flex w-full items-center gap-2 p-1">
      <Skeleton className="h-7 w-24 rounded-full" />
    </div>
  );
}

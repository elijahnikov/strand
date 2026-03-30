import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Doc, Id } from "@strand/backend/_generated/dataModel.js";
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
import { useQuery } from "@tanstack/react-query";
import type { UseNavigateResult } from "@tanstack/react-router";
import { useNavigate, useParams } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { getWorkspaceIcon } from "~/lib/workspace-icons";

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
  const WorkspaceIcon = getWorkspaceIcon(workspace.icon);
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
      <span className="flex size-5 shrink-0 items-center justify-center rounded text-xs">
        <WorkspaceIcon className="size-4 shrink-0 text-ui-fg-subtle!" />
      </span>
      <span className="truncate">{workspace.name}</span>
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

  const CurrentWorkspaceIcon = getWorkspaceIcon(current?.icon);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-ui-bg-base text-center text-sm shadow-buttons-neutral hover:bg-ui-bg-component-hover active:bg-ui-bg-component-pressed">
        <span className="font-medium">
          <CurrentWorkspaceIcon className="size-4 shrink-0 text-ui-fg-subtle" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="-mt-0.75 w-56 max-w-56 overflow-x-hidden"
        side="right"
        sideOffset={9}
      >
        {owned.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="m-0 p-0 py-1! pl-1! text-[11px] text-ui-fg-subtle">
              Your workspaces
            </DropdownMenuLabel>
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
      <Skeleton className="size-6 rounded-md" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

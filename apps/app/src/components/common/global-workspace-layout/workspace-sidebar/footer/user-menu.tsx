import { convexQuery } from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import type { Doc, Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@omi/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Skeleton } from "@omi/ui/skeleton";
import { useTheme } from "@omi/ui/theme";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { UseNavigateResult } from "@tanstack/react-router";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import BoringAvatar from "boring-avatars";
import {
  CheckIcon,
  FolderOpenIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { WorkspaceIcon } from "~/components/common/workspace-icon";

type Workspace = Doc<"workspace"> & { role: string };

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "auto", label: "System", icon: MonitorIcon },
] as const;

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
        className={cn(workspace.emoji && "mr-1 -ml-1")}
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

function WorkspaceSubMenu() {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const { data: workspaces } = useQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );

  const _current = workspaces?.find((w) => w._id === workspaceId);
  const owned = workspaces?.filter((w) => w.role === "owner") ?? [];
  const memberOf = workspaces?.filter((w) => w.role !== "owner") ?? [];

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderOpenIcon />
        <span className="truncate">Workspaces</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 max-w-56 overflow-x-hidden">
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
            <div className="flex flex-col gap-y-2 space-y-2">
              {memberOf.map((workspace) => (
                <WorkspaceItem
                  isActive={workspace._id === workspaceId}
                  key={workspace._id}
                  onSelect={navigate}
                  workspace={workspace}
                />
              ))}
            </div>
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <PlusIcon />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function ThemeSubMenu() {
  const { themeMode, setTheme } = useTheme();
  const activeOption =
    THEME_OPTIONS.find((option) => option.value === themeMode) ??
    THEME_OPTIONS[2];
  const ActiveIcon = activeOption.icon;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ActiveIcon />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = themeMode === value;
          return (
            <DropdownMenuItem
              className={isActive ? "bg-ui-bg-component-hover" : ""}
              key={value}
              onClick={() => setTheme(value)}
            >
              <Icon />
              <span className={cn("flex-1", isActive && "text-ui-fg-base")}>
                {label}
              </span>
              {isActive && <CheckIcon className="ml-2 size-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function UserMenu() {
  const router = useRouter();
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );

  const user = data.user;
  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7! w-full items-center gap-2 rounded-full text-left text-sm hover:bg-accent"
        render={<Avatar className="size-6" />}
      >
        {user.image && <AvatarImage src={user.image} />}
        <AvatarFallback>
          <BoringAvatar name={user.username} size={28} variant="marble" />
        </AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={"relative"}
        side="bottom"
        sideOffset={6}
      >
        <DropdownMenuItem onClick={() => router.navigate({ to: "/account" })}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <WorkspaceSubMenu />
        <ThemeSubMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.navigate({ to: "/login" });
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex w-full items-center gap-2 p-1">
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

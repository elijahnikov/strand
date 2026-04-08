import { convexQuery } from "@convex-dev/react-query";
import { authClient } from "@strand/auth/client";
import { api } from "@strand/backend/_generated/api.js";
import { Avatar, AvatarFallback, AvatarImage } from "@strand/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Skeleton } from "@strand/ui/skeleton";
import { useTheme } from "@strand/ui/theme";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import BoringAvatar from "boring-avatars";
import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "auto", label: "System", icon: MonitorIcon },
] as const;

export function UserMenu() {
  const router = useRouter();
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );
  const { themeMode, setTheme } = useTheme();

  const user = data.user;
  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8! w-full items-center gap-2 rounded-full text-left text-sm hover:bg-accent"
        render={<Avatar className="size-7" />}
      >
        {user.image && <AvatarImage src={user.image} />}
        <AvatarFallback>
          <BoringAvatar name={user.username} size={28} variant="marble" />
        </AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={"relative"}
        side="right"
        sideOffset={6}
      >
        <DropdownMenuItem>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center gap-1 px-0.5 py-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 font-medium text-xs transition-colors ${
                themeMode === value
                  ? "bg-ui-bg-component-hover text-ui-fg-base"
                  : "text-ui-fg-muted hover:text-ui-fg-subtle"
              }`}
              key={value}
              onClick={() => setTheme(value)}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
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

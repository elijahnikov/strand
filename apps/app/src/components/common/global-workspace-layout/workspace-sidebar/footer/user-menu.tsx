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
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { LogOutIcon, SettingsIcon } from "lucide-react";

export function UserMenu() {
  const router = useRouter();
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );

  const user = data.user;
  if (!user) {
    return null;
  }

  const initials = user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md text-left text-sm hover:bg-accent">
        <Avatar className="ml-0.5 size-7">
          {user.image && <AvatarImage src={user.image} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium">{user.username}</span>
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

import { cn } from "@strand/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@strand/ui/tooltip";
import { UserAvatar } from "~/components/common/user-avatar";
import { useWorkspacePresenceSafe } from ".";

export function WorkspacePresenceAvatars() {
  const presence = useWorkspacePresenceSafe();

  if (!presence || presence.isLoading || presence.users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center -space-x-1.5">
      {presence.users.map((user, index) => (
        <Tooltip key={user._id}>
          <TooltipTrigger
            className="relative cursor-default"
            render={<div />}
            style={{ zIndex: presence.users.length - index }}
          >
            <UserAvatar
              className={cn(!user.online && "opacity-75", "size-7 ring-0")}
              image={user.image ?? undefined}
              name={user.username}
              size={28}
            />
            {user.online && (
              <span
                className={`absolute -right-px -bottom-px size-2 rounded-full ring-1.5 ring-ui-bg-base ${
                  user.online ? "bg-emerald-500" : "bg-ui-fg-muted"
                }`}
              />
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {user.username}
            <span className="font-mono text-ui-fg-subtle">
              {user.online ? "" : " away"}
            </span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

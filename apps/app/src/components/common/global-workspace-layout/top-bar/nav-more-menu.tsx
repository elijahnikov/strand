import { RiMoreFill, RiQuestionFill, RiSettings4Fill } from "@remixicon/react";
import { Button } from "@strand/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

interface NavMoreMenuProps {
  workspaceId: string;
}

export function NavMoreMenu({ workspaceId }: NavMoreMenuProps) {
  const buttonClassName =
    "group/menu flex h-7 w-7 items-center rounded-full text-left font-sans text-[13px] text-ui-fg-muted/70 transition-colors duration-200 hover:bg-[rgba(0,0,0,0.070)] hover:text-ui-fg-base focus-visible:bg-transparent! focus-visible:shadow-borders-interactive-with-active! dark:hover:bg-[rgba(255,255,255,0.070)]";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="More"
            className={buttonClassName}
            size="small"
            variant="ghost"
          />
        }
      >
        <RiMoreFill className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[105]! w-48"
        sideOffset={6}
      >
        <DropdownMenuItem
          render={
            <Link
              params={{ workspaceId }}
              preload="intent"
              to="/workspace/$workspaceId/settings"
            />
          }
        >
          <RiSettings4Fill />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            // biome-ignore lint/a11y/useAnchorContent: <>
            <a
              href={"https://docs.strand.co"}
              rel="noopener noreferrer"
              target="_blank"
            />
          }
        >
          <RiQuestionFill />
          Help & Feedback
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

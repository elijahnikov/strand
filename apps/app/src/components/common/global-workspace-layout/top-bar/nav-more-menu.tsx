import {
  RiArrowRightUpLongLine,
  RiDeleteBin6Line,
  RiMoreFill,
  RiQuestionFill,
  RiSettings4Fill,
} from "@remixicon/react";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@strand/ui/kbd";
import { Link, useLocation, useParams } from "@tanstack/react-router";

interface NavMoreMenuProps {
  workspaceId: string;
}

export function NavMoreMenu({ workspaceId }: NavMoreMenuProps) {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (location) => location.pathname });
  const workspacePath = `/workspace/${params.workspaceId}`;

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
          className={cn(
            pathname === `${workspacePath}/trash` &&
              "pointer-events-none bg-[rgba(0,0,0,0.070)] text-ui-fg-base dark:bg-[rgba(255,255,255,0.070)]"
          )}
          render={
            <Link
              params={{ workspaceId }}
              preload="intent"
              to="/workspace/$workspaceId/trash"
            />
          }
        >
          <RiDeleteBin6Line />
          Trash
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            pathname === `${workspacePath}/settings` &&
              "pointer-events-none bg-[rgba(0,0,0,0.070)] text-ui-fg-base dark:bg-[rgba(255,255,255,0.070)]"
          )}
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
          <KbdGroup className="mr-1 ml-auto">
            <span className="flex items-center gap-1">
              <Kbd className="h-4! min-w-4 border-[0.5px] font-mono text-[10px] text-ui-fg-base">
                G
              </Kbd>

              <Kbd className="h-4! min-w-4 border-[0.5px] font-mono text-[10px] text-ui-fg-base">
                ,
              </Kbd>
            </span>
          </KbdGroup>
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
          Help <RiArrowRightUpLongLine className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@omi/ui/tooltip";
import { RiArrowRightUpLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { ShortcutTooltipBody } from "~/components/common/shortcut-tooltip";

interface SidebarLinkItemProps {
  className?: string;
  external?: boolean;
  icon: React.ElementType;
  isActive?: boolean;
  shortcut?: string[];
  sidebarOpen?: boolean;
  title: string;
  url: string;
}

function SidebarLinkItem({
  url,
  title,
  icon,
  isActive,
  external,
  shortcut,
  className,
  sidebarOpen,
}: SidebarLinkItemProps) {
  const Icon = icon as React.ComponentType<{ className?: string }>;

  const buttonClassName = cn(
    "group/menu flex h-7.5 gap-x-2 overflow-hidden rounded-md px-2 text-left font-sans text-[13px] focus-visible:bg-transparent! focus-visible:shadow-borders-interactive-with-active!",
    isActive
      ? cn("border-[0.5px] bg-ui-bg-base text-ui-fg-base")
      : "text-ui-fg-muted/70 transition-colors duration-200 hover:bg-[rgba(0,0,0,0.070)] hover:text-ui-fg-base dark:hover:bg-[rgba(255,255,255,0.070)]",
    sidebarOpen
      ? "w-full items-center justify-start"
      : "items-center! justify-center! w-7.5!",
    className
  );

  const fadeClassName =
    "whitespace-nowrap transition-[opacity,filter] duration-200 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:blur-[4px]";

  const buttonVariant = "ghost";

  if (external) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className={buttonClassName}
              render={
                // biome-ignore lint/a11y/useAnchorContent: content provided by TooltipTrigger children
                <a href={url} rel="noopener noreferrer" target="_blank" />
              }
              size="small"
              variant={buttonVariant}
            />
          }
        >
          <Icon className="size-3.5 shrink-0" />
          {sidebarOpen && (
            <Text className={fadeClassName} size={"small"} weight="plus">
              {title}
            </Text>
          )}
          {sidebarOpen && (
            <RiArrowRightUpLine
              className={cn("ml-auto size-3.5 shrink-0", fadeClassName)}
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="right">
          <ShortcutTooltipBody shortcut={shortcut} title={title} />
        </TooltipContent>
      </Tooltip>
    );
  }

  const button = (
    <Button
      className={buttonClassName}
      render={<Link preload="intent" preloadDelay={100} search={{}} to={url} />}
      size="small"
      variant={buttonVariant}
    >
      <Icon className="size-3.5 shrink-0" />
      {sidebarOpen && (
        <Text className={fadeClassName} size={"small"} weight="plus">
          {title}
        </Text>
      )}
    </Button>
  );

  if (!shortcut) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent className={"rounded-md"} side="right">
        <ShortcutTooltipBody shortcut={shortcut} title={title} />
      </TooltipContent>
    </Tooltip>
  );
}

export default memo(SidebarLinkItem);

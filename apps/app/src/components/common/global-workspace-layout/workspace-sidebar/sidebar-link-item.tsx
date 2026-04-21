import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@omi/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { ShortcutTooltipBody } from "~/components/common/shortcut-tooltip";

interface SidebarLinkItemProps {
  external?: boolean;
  icon: React.ElementType;
  isActive?: boolean;
  shortcut?: string[];
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
}: SidebarLinkItemProps) {
  const Icon = icon as React.ComponentType<{ className?: string }>;

  const buttonClassName = cn(
    "group/menu flex h-7 items-center rounded-full text-left font-sans text-[13px] focus-visible:bg-transparent! focus-visible:shadow-borders-interactive-with-active!",
    isActive
      ? "pointer-events-none bg-[rgba(0,0,0,0.070)] text-ui-fg-base dark:bg-[rgba(255,255,255,0.070)]"
      : "text-ui-fg-muted/70 transition-colors duration-200 hover:bg-[rgba(0,0,0,0.070)] hover:text-ui-fg-base dark:hover:bg-[rgba(255,255,255,0.070)]"
  );

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
      <Text size={"small"} weight="plus">
        {title}
      </Text>
    </Button>
  );

  if (!shortcut) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom">
        <ShortcutTooltipBody shortcut={shortcut} title={title} />
      </TooltipContent>
    </Tooltip>
  );
}

export default memo(SidebarLinkItem);

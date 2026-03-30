import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@strand/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { memo } from "react";

interface SidebarLinkItemProps {
  external?: boolean;
  icon: React.ElementType;
  isActive?: boolean;
  title: string;
  url: string;
}

function SidebarLinkItem({
  url,
  title,
  icon,
  isActive,
  external,
}: SidebarLinkItemProps) {
  const Icon = icon as React.ComponentType<{ className?: string }>;

  const buttonClassName = cn(
    "group/menu flex h-7 w-7 items-center rounded-full text-left font-sans text-[13px] focus-visible:bg-transparent! focus-visible:shadow-borders-interactive-with-active!",
    isActive
      ? "bg-[rgba(0,0,0,0.070)] text-ui-fg-base dark:bg-[rgba(255,255,255,0.070)]"
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
        <TooltipContent side="right">{title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={buttonClassName}
            render={
              <Link preload="intent" preloadDelay={100} search={{}} to={url} />
            }
            size="small"
            variant={buttonVariant}
          />
        }
      >
        <Icon className="size-4 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  );
}

export default memo(SidebarLinkItem);

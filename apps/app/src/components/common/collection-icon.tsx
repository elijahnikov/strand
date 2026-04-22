import { cn } from "@omi/ui";
import { FolderIcon } from "lucide-react";
import { getWorkspaceIcon } from "~/lib/workspace-icons";

const sizeConfig = {
  xs: { container: "size-4", emoji: "text-[11px]", icon: "size-3" },
  sm: { container: "size-5", emoji: "text-xs", icon: "size-3.5" },
  md: { container: "size-6", emoji: "text-sm", icon: "size-4" },
  lg: { container: "size-8", emoji: "text-base", icon: "size-5" },
  xl: { container: "size-12", emoji: "text-3xl", icon: "size-8" },
} as const;

interface CollectionIconProps {
  className?: string;
  // When `iconColor` is set, `icon` is an icon name; otherwise it is an emoji.
  icon?: string;
  iconColor?: string;
  size?: keyof typeof sizeConfig;
}

export function CollectionIcon({
  icon,
  iconColor,
  size = "md",
  className,
}: CollectionIconProps) {
  const config = sizeConfig[size];

  if (icon && !iconColor) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          config.container,
          config.emoji,
          className
        )}
      >
        {icon}
      </span>
    );
  }

  const IconComponent = icon ? getWorkspaceIcon(icon) : FolderIcon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        config.container,
        className
      )}
    >
      <IconComponent
        className={cn(config.icon, "shrink-0 text-ui-fg-muted")}
        style={iconColor ? { color: iconColor } : undefined}
      />
    </span>
  );
}

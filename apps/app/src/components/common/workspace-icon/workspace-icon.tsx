import { cn } from "@omi/ui";
import { BoxIcon } from "lucide-react";
import { getWorkspaceIcon } from "~/lib/workspace-icons";

const sizeConfig = {
  xs: { container: "size-5", emoji: "text-sm", icon: "size-3" },
  sm: { container: "size-6", emoji: "text-sm", icon: "size-3.5" },
  md: { container: "size-8", emoji: "text-base", icon: "size-4" },
  lg: { container: "size-10", emoji: "text-lg", icon: "size-5" },
} as const;

interface WorkspaceIconProps {
  className?: string;
  emoji?: string;
  icon?: string;
  iconColor?: string;
  size?: keyof typeof sizeConfig;
}

export function WorkspaceIcon({
  icon,
  iconColor,
  emoji,
  size = "md",
  className,
}: WorkspaceIconProps) {
  const config = sizeConfig[size];

  if (emoji) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md",
          config.container,
          config.emoji,
          className
        )}
      >
        {emoji}
      </span>
    );
  }

  const IconComponent = icon ? getWorkspaceIcon(icon) : BoxIcon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        config.container,
        className
      )}
    >
      <IconComponent
        className={cn(config.icon, "shrink-0")}
        style={iconColor ? { color: iconColor } : undefined}
      />
    </span>
  );
}

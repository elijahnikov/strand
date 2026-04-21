import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@omi/ui";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";
import type { ReactNode } from "react";

export function EmptyState({
  Icon,
  title,
  description,
  action,
  className,
}: {
  Icon?: RemixiconComponentType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-20 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-3 rounded-lg border-[0.5px] bg-ui-bg-component p-2.5 text-ui-fg-muted">
          <Icon className="size-5" />
        </div>
      ) : null}
      <Heading className="font-medium text-sm text-ui-fg-base">{title}</Heading>
      {description ? (
        <Text className="mt-1 max-w-sm text-ui-fg-subtle text-xs">
          {description}
        </Text>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

import { cn } from "@omi/ui";
import type { RemixiconComponentType } from "@remixicon/react";

export function HomeCard({
  className,
  children,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-lg bg-ui-bg-component p-4",
        interactive &&
          "transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function HomeCardHeader({
  Icon,
  title,
  subtitle,
}: {
  Icon: RemixiconComponentType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
        <Icon className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="font-medium text-sm text-ui-fg-base">{title}</p>
        {subtitle ? (
          <p className="text-ui-fg-subtle text-xs">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HomeSectionHeader({
  Icon,
  title,
  hint,
}: {
  Icon: RemixiconComponentType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-3.5 text-ui-fg-muted" />
      <p className="font-medium text-sm text-ui-fg-base">{title}</p>
      {hint ? (
        <p className="ml-auto text-ui-fg-subtle text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

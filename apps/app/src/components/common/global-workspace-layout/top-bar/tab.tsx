import { cn } from "@strand/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, memo, type ReactNode, useCallback } from "react";
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from "~/lib/workspace-tabs-store";

interface TabProps {
  icon: ReactNode;
  isActive: boolean;
  tab: WorkspaceTab;
  workspaceId: string;
}

function TabComponent({ tab, isActive, workspaceId, icon }: TabProps) {
  const closeTab = useWorkspaceTabs((s) => s.closeTab);
  const navigate = useNavigate();

  const handleClose = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const { nextUrl, wasActive } = closeTab(workspaceId, tab.id);
      if (wasActive && nextUrl) {
        navigate({ to: nextUrl });
      }
    },
    [closeTab, navigate, tab.id, workspaceId]
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault();
        handleClose(event);
      }
    },
    [handleClose]
  );

  return (
    <div
      className={cn(
        "group/tab relative flex shrink-0 items-end",
        isActive ? "sticky right-2 left-2 z-[2] h-9" : "mb-2 h-8"
      )}
      data-active={isActive || undefined}
    >
      <Link
        className={cn(
          "relative flex min-w-[120px] max-w-[220px] items-center gap-1.5 px-3 font-medium text-[13px] outline-none transition-colors",
          isActive
            ? "z-[100] h-9.5 rounded-t-lg rounded-b-0 bg-ui-bg-base pb-1 text-ui-fg-base ring-[0.5px] ring-ui-border-base"
            : "h-7 rounded-full text-ui-fg-muted hover:bg-ui-bg-component-hover hover:text-ui-fg-base"
        )}
        onMouseDown={handleMouseDown}
        preload="intent"
        preloadDelay={100}
        to={tab.url}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center text-ui-fg-muted">
          {icon}
        </span>
        <span className="truncate">{tab.title}</span>
      </Link>
      {/* {!(isActive || isLast) && (
        <span
          aria-hidden
          className="absolute top-2 right-0 bottom-2 w-px bg-ui-border-base/40 transition-opacity group-hover/tab:opacity-0"
        />
      )} */}
      {isActive && <TabCorners />}
    </div>
  );
}

function TabCorners() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[-10px] z-[100] size-[10px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, transparent 9.25px, var(--border-base) 9.5px, var(--border-base) 9.5px, var(--bg-base) 10px)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-10px] bottom-0 z-[100] size-[10px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at top right, transparent 9.25px, var(--border-base) 9.5px, var(--border-base) 9.5px, var(--bg-base) 10px)",
        }}
      />
    </>
  );
}

export const Tab = memo(TabComponent);

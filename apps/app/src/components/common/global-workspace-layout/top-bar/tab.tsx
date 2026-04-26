import { cn } from "@omi/ui";
import { ContextMenu } from "@omi/ui/context-menu";
import { RiCloseLine } from "@remixicon/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, memo, useCallback } from "react";
import { TabIcon } from "~/components/common/global-workspace-layout/top-bar/tab-icon";
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from "~/lib/workspace-tabs-store";

interface TabProps {
  isActive: boolean;
  tab: WorkspaceTab;
  workspaceId: string;
}

function TabComponent({ tab, isActive, workspaceId }: TabProps) {
  const closeTab = useWorkspaceTabs((s) => s.closeTab);
  const closeOthers = useWorkspaceTabs((s) => s.closeOthers);
  const closeToRight = useWorkspaceTabs((s) => s.closeToRight);
  const closeAll = useWorkspaceTabs((s) => s.closeAll);
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

  const handleOpen = useCallback(() => {
    navigate({ to: tab.url });
  }, [navigate, tab.url]);

  const handleCloseFromMenu = useCallback(() => {
    const { nextUrl, wasActive } = closeTab(workspaceId, tab.id);
    if (wasActive && nextUrl) {
      navigate({ to: nextUrl });
    }
  }, [closeTab, navigate, tab.id, workspaceId]);

  const handleCloseOthers = useCallback(() => {
    const { nextUrl } = closeOthers(workspaceId, tab.id);
    if (nextUrl) {
      navigate({ to: nextUrl });
    }
  }, [closeOthers, navigate, tab.id, workspaceId]);

  const handleCloseToRight = useCallback(() => {
    const { nextUrl } = closeToRight(workspaceId, tab.id);
    if (nextUrl) {
      navigate({ to: nextUrl });
    }
  }, [closeToRight, navigate, tab.id, workspaceId]);

  const handleCloseAll = useCallback(() => {
    const { nextUrl } = closeAll(workspaceId);
    if (nextUrl) {
      navigate({ to: nextUrl });
    }
  }, [closeAll, navigate, workspaceId]);

  return (
    <ContextMenu>
      <ContextMenu.Trigger
        render={
          <div
            className={cn(
              "group/tab relative flex shrink-0 items-end",
              isActive ? "sticky right-4.5 left-4.5 z-[2] h-9" : "mb-2 h-8"
            )}
            data-active={isActive || undefined}
          />
        }
      >
        <Link
          className={cn(
            "relative flex min-w-[120px] max-w-[220px] items-center gap-1.5 px-2 font-medium text-[13px] outline-none transition-colors",
            isActive
              ? "-top-[0.5px] z-[100] h-9.5 rounded-t-lg rounded-b-0 bg-ui-bg-base pb-[6.5px] text-ui-fg-base"
              : "h-7 rounded-full text-ui-fg-muted hover:bg-[rgba(0,0,0,0.070)] hover:text-ui-fg-base dark:hover:bg-[rgba(255,255,255,0.070)]"
          )}
          onMouseDown={handleMouseDown}
          preload="intent"
          preloadDelay={100}
          to={tab.url}
        >
          <span className="flex shrink-0 items-center justify-center text-ui-fg-muted">
            <TabIcon tab={tab} workspaceId={workspaceId} />
          </span>
          <span className="truncate">{tab.title}</span>
          <button
            aria-label={`Close ${tab.title}`}
            className="ml-auto flex size-3 shrink-0 items-center justify-center rounded-full text-ui-fg-muted hover:bg-black/8 hover:text-ui-fg-base dark:hover:bg-white/10"
            onClick={handleClose}
            type="button"
          >
            <RiCloseLine className="size-3" />
          </button>
        </Link>
        {isActive && <TabCorners />}
      </ContextMenu.Trigger>
      <ContextMenu.Content className="z-[110]!">
        <ContextMenu.Item onClick={handleOpen}>Open</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onClick={handleCloseFromMenu}>Close</ContextMenu.Item>
        <ContextMenu.Item onClick={handleCloseOthers}>
          Close others
        </ContextMenu.Item>
        <ContextMenu.Item onClick={handleCloseToRight}>
          Close to the right
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onClick={handleCloseAll} variant="destructive">
          Close all
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}

function TabCorners() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[0.5px] left-[-12px] z-[100] size-[12px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, transparent 11.25px, transparent 11.5px, transparent 11.5px, var(--bg-base) 12px)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-12px] bottom-[0.5px] z-[100] size-[12px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at top right, transparent 11.25px, transparent 11.5px, transparent 11.5px, var(--bg-base) 12px)",
        }}
      />
    </>
  );
}

export const Tab = memo(TabComponent);

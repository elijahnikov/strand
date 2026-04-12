import { ScrollArea } from "@strand/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { Tab } from "~/components/common/global-workspace-layout/top-bar/tab";
import { TabIcon } from "~/components/common/global-workspace-layout/top-bar/tab-icon";
import {
  useWorkspaceTabs,
  useWorkspaceTabsHydrated,
} from "~/lib/workspace-tabs-store";

interface TabStripProps {
  workspaceId: string;
}

const EMPTY: never[] = [];

interface OverlayPos {
  left: number;
  width: number;
}

export function TabStrip({ workspaceId }: TabStripProps) {
  const hydrated = useWorkspaceTabsHydrated();
  const tabs = useWorkspaceTabs((s) => s.tabsByWorkspace[workspaceId] ?? EMPTY);
  const activeId = useWorkspaceTabs((s) => s.activeByWorkspace[workspaceId]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [_overlay, setOverlay] = useState<OverlayPos | null>(null);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    const el = rootRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]'
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: DOM query depends on activeId/tabs rendering
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const compute = () => {
      const tabEl = root.querySelector<HTMLElement>('[data-active="true"]');
      if (!tabEl) {
        setOverlay(null);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      setOverlay({
        left: tabRect.left - rootRect.left,
        width: tabRect.width,
      });
    };

    compute();

    const viewport = root.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    );
    viewport?.addEventListener("scroll", compute, { passive: true });
    const ro = new ResizeObserver(compute);
    ro.observe(root);

    return () => {
      viewport?.removeEventListener("scroll", compute);
      ro.disconnect();
    };
  }, [activeId, tabs.length]);

  if (!hydrated || tabs.length === 0) {
    return <div className="min-w-0 flex-1" />;
  }

  return (
    <div className="relative mb-[3.7px] flex h-10 min-w-0 flex-1" ref={rootRef}>
      <ScrollArea className="h-11 min-w-0 flex-1 **:data-[slot=scroll-area-scrollbar]:hidden">
        <div className="flex h-11 items-end gap-x-2 pr-4 pl-4">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <Tab
                icon={<TabIcon tab={tab} workspaceId={workspaceId} />}
                isActive={isActive}
                key={tab.id}
                tab={tab}
                workspaceId={workspaceId}
              />
            );
          })}
        </div>
      </ScrollArea>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 left-0 z-[1] w-6 bg-gradient-to-r from-ui-bg-subtle to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-[1] w-6 bg-gradient-to-l from-ui-bg-subtle to-transparent"
      />
      {/* {overlay && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[-2px] z-[3] h-[3px] bg-ui-bg-base"
          style={{
            left: `${overlay.left - 8}px`,
            width: `${overlay.width + 16}px`,
          }}
        />
      )} */}
    </div>
  );
}

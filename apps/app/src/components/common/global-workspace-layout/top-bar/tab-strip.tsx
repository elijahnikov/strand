import { ScrollArea } from "@strand/ui/scroll-area";
import { useEffect, useRef } from "react";
import { Tab } from "~/components/common/global-workspace-layout/top-bar/tab";
import {
  useWorkspaceTabs,
  useWorkspaceTabsHydrated,
} from "~/lib/workspace-tabs-store";

interface TabStripProps {
  workspaceId: string;
}

const EMPTY: never[] = [];

export function TabStrip({ workspaceId }: TabStripProps) {
  const hydrated = useWorkspaceTabsHydrated();
  const tabs = useWorkspaceTabs((s) => s.tabsByWorkspace[workspaceId] ?? EMPTY);
  const activeId = useWorkspaceTabs((s) => s.activeByWorkspace[workspaceId]);

  const rootRef = useRef<HTMLDivElement | null>(null);

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

  if (!hydrated || tabs.length === 0) {
    return <div className="min-w-0 flex-1" />;
  }

  return (
    <div className="relative mb-[3.7px] flex h-10 min-w-0 flex-1" ref={rootRef}>
      <ScrollArea className="h-11 min-w-0 flex-1 **:data-[slot=scroll-area-scrollbar]:hidden">
        <div className="flex h-11 items-end gap-x-2 pr-4 pl-4">
          {tabs.map((tab) => (
            <Tab
              isActive={tab.id === activeId}
              key={tab.id}
              tab={tab}
              workspaceId={workspaceId}
            />
          ))}
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
    </div>
  );
}

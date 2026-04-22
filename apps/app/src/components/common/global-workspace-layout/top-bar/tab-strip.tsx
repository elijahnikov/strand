import { ScrollArea } from "@omi/ui/scroll-area";
import type { UseHotkeyDefinition } from "@tanstack/react-hotkeys";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { Tab } from "~/components/common/global-workspace-layout/top-bar/tab";
import {
  useWorkspaceTabs,
  useWorkspaceTabsHydrated,
} from "~/lib/workspace-tabs-store";

interface TabStripProps {
  workspaceId: string;
}

const EMPTY: never[] = [];

const TAB_HOTKEYS = [
  "Mod+1",
  "Mod+2",
  "Mod+3",
  "Mod+4",
  "Mod+5",
  "Mod+6",
  "Mod+7",
  "Mod+8",
  "Mod+9",
] as const;

export function TabStrip({ workspaceId }: TabStripProps) {
  const hydrated = useWorkspaceTabsHydrated();
  const tabs = useWorkspaceTabs((s) => s.tabsByWorkspace[workspaceId] ?? EMPTY);
  const activeId = useWorkspaceTabs((s) => s.activeByWorkspace[workspaceId]);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const tabHotkeys = useMemo<UseHotkeyDefinition[]>(() => {
    const defs: UseHotkeyDefinition[] = [];
    for (let i = 0; i < TAB_HOTKEYS.length; i++) {
      const tab = tabs[i];
      if (!tab) {
        break;
      }
      const hotkey = TAB_HOTKEYS[i];
      if (!hotkey) {
        break;
      }
      defs.push({
        hotkey,
        callback: () => {
          navigate({ to: tab.url });
        },
      });
    }
    const last = tabs.at(-1);
    if (last) {
      defs.push({
        hotkey: "Mod+0",
        callback: () => {
          navigate({ to: last.url });
        },
      });
    }
    return defs;
  }, [tabs, navigate]);

  useHotkeys(tabHotkeys);

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
    <div
      className="relative mr-4 mb-[3.7px] flex h-10 min-w-0 flex-1"
      ref={rootRef}
    >
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
        className="pointer-events-none absolute top-0 bottom-0 left-0 z-[1] w-6 bg-linear-to-r from-ui-bg-subtle to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-[1] w-12 bg-linear-to-l from-50% from-ui-bg-subtle to-transparent"
      />
    </div>
  );
}

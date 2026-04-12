import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TabKind = "resource" | "tag" | "chat" | "collection";

export interface WorkspaceTab {
  entityId: string;
  id: string;
  kind: TabKind;
  title: string;
  url: string;
}

interface TabsState {
  activeByWorkspace: Record<string, string | undefined>;
  clearActive: (workspaceId: string) => void;
  closeTab: (
    workspaceId: string,
    id: string
  ) => { nextUrl: string | null; wasActive: boolean };

  openOrActivate: (workspaceId: string, tab: WorkspaceTab) => void;
  reorder: (workspaceId: string, fromIdx: number, toIdx: number) => void;
  setActive: (workspaceId: string, id: string) => void;
  tabsByWorkspace: Record<string, WorkspaceTab[]>;
  updateTitle: (workspaceId: string, id: string, title: string) => void;
}

export const useWorkspaceTabs = create<TabsState>()(
  persist(
    (set, get) => ({
      tabsByWorkspace: {},
      activeByWorkspace: {},

      openOrActivate: (workspaceId, tab) => {
        const existing = get().tabsByWorkspace[workspaceId] ?? [];
        const match = existing.find((t) => t.id === tab.id);
        const nextTabs = match
          ? existing.map((t) =>
              t.id === tab.id ? { ...t, url: tab.url, title: tab.title } : t
            )
          : [...existing, tab];
        set({
          tabsByWorkspace: {
            ...get().tabsByWorkspace,
            [workspaceId]: nextTabs,
          },
          activeByWorkspace: {
            ...get().activeByWorkspace,
            [workspaceId]: tab.id,
          },
        });
      },

      closeTab: (workspaceId, id) => {
        const tabs = get().tabsByWorkspace[workspaceId] ?? [];
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) {
          return { nextUrl: null, wasActive: false };
        }
        const wasActive = get().activeByWorkspace[workspaceId] === id;
        const nextTabs = tabs.filter((t) => t.id !== id);
        const neighbour =
          nextTabs[idx] ?? nextTabs[idx - 1] ?? nextTabs.at(-1) ?? null;
        const nextActive = wasActive
          ? neighbour?.id
          : get().activeByWorkspace[workspaceId];
        set({
          tabsByWorkspace: {
            ...get().tabsByWorkspace,
            [workspaceId]: nextTabs,
          },
          activeByWorkspace: {
            ...get().activeByWorkspace,
            [workspaceId]: nextActive,
          },
        });
        if (!wasActive) {
          return { nextUrl: null, wasActive: false };
        }
        const nextUrl = neighbour?.url ?? `/workspace/${workspaceId}`;
        return { nextUrl, wasActive: true };
      },

      setActive: (workspaceId, id) => {
        set({
          activeByWorkspace: {
            ...get().activeByWorkspace,
            [workspaceId]: id,
          },
        });
      },

      reorder: (workspaceId, fromIdx, toIdx) => {
        const tabs = get().tabsByWorkspace[workspaceId] ?? [];
        if (
          fromIdx < 0 ||
          toIdx < 0 ||
          fromIdx >= tabs.length ||
          toIdx >= tabs.length ||
          fromIdx === toIdx
        ) {
          return;
        }
        const next = [...tabs];
        const [moved] = next.splice(fromIdx, 1);
        if (moved) {
          next.splice(toIdx, 0, moved);
        }
        set({
          tabsByWorkspace: {
            ...get().tabsByWorkspace,
            [workspaceId]: next,
          },
        });
      },

      updateTitle: (workspaceId, id, title) => {
        const tabs = get().tabsByWorkspace[workspaceId] ?? [];
        const match = tabs.find((t) => t.id === id);
        if (!match || match.title === title) {
          return;
        }
        set({
          tabsByWorkspace: {
            ...get().tabsByWorkspace,
            [workspaceId]: tabs.map((t) => (t.id === id ? { ...t, title } : t)),
          },
        });
      },

      clearActive: (workspaceId) => {
        set({
          activeByWorkspace: {
            ...get().activeByWorkspace,
            [workspaceId]: undefined,
          },
        });
      },
    }),
    {
      name: "strand-workspace-tabs",
      version: 1,
    }
  )
);

export function useWorkspaceTabsHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useWorkspaceTabs.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useWorkspaceTabs.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);
  return hydrated;
}

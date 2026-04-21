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
  closeAll: (workspaceId: string) => { nextUrl: string | null };
  closeOthers: (
    workspaceId: string,
    keepId: string
  ) => { nextUrl: string | null };
  closeTab: (
    workspaceId: string,
    id: string
  ) => { nextUrl: string | null; wasActive: boolean };
  closeToRight: (
    workspaceId: string,
    anchorId: string
  ) => { nextUrl: string | null };

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
        const state = get();
        const existing = state.tabsByWorkspace[workspaceId] ?? [];
        const match = existing.find((t) => t.id === tab.id);
        const alreadyActive = state.activeByWorkspace[workspaceId] === tab.id;

        // Existing tab: only toggle active; never overwrite title/url
        // (titles are managed by updateTitle from resolved queries).
        if (match) {
          if (alreadyActive) {
            return;
          }
          set({
            activeByWorkspace: {
              ...state.activeByWorkspace,
              [workspaceId]: tab.id,
            },
          });
          return;
        }

        // New tab: append and activate.
        set({
          tabsByWorkspace: {
            ...state.tabsByWorkspace,
            [workspaceId]: [...existing, tab],
          },
          activeByWorkspace: {
            ...state.activeByWorkspace,
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

      closeOthers: (workspaceId, keepId) => {
        const state = get();
        const tabs = state.tabsByWorkspace[workspaceId] ?? [];
        const keep = tabs.find((t) => t.id === keepId);
        if (!keep || tabs.length <= 1) {
          return { nextUrl: null };
        }
        const wasActive = state.activeByWorkspace[workspaceId] === keepId;
        set({
          tabsByWorkspace: {
            ...state.tabsByWorkspace,
            [workspaceId]: [keep],
          },
          activeByWorkspace: {
            ...state.activeByWorkspace,
            [workspaceId]: keepId,
          },
        });
        return { nextUrl: wasActive ? null : keep.url };
      },

      closeToRight: (workspaceId, anchorId) => {
        const state = get();
        const tabs = state.tabsByWorkspace[workspaceId] ?? [];
        const idx = tabs.findIndex((t) => t.id === anchorId);
        if (idx === -1 || idx === tabs.length - 1) {
          return { nextUrl: null };
        }
        const kept = tabs.slice(0, idx + 1);
        const removedIds = new Set(tabs.slice(idx + 1).map((t) => t.id));
        const currentActive = state.activeByWorkspace[workspaceId];
        const activeWasRemoved =
          !!currentActive && removedIds.has(currentActive);
        const nextActive = activeWasRemoved ? anchorId : currentActive;
        set({
          tabsByWorkspace: {
            ...state.tabsByWorkspace,
            [workspaceId]: kept,
          },
          activeByWorkspace: {
            ...state.activeByWorkspace,
            [workspaceId]: nextActive,
          },
        });
        const anchor = kept.at(-1);
        return {
          nextUrl: activeWasRemoved && anchor ? anchor.url : null,
        };
      },

      closeAll: (workspaceId) => {
        const state = get();
        const hadActive = state.activeByWorkspace[workspaceId] !== undefined;
        set({
          tabsByWorkspace: {
            ...state.tabsByWorkspace,
            [workspaceId]: [],
          },
          activeByWorkspace: {
            ...state.activeByWorkspace,
            [workspaceId]: undefined,
          },
        });
        return { nextUrl: hadActive ? `/workspace/${workspaceId}` : null };
      },

      setActive: (workspaceId, id) => {
        const state = get();
        if (state.activeByWorkspace[workspaceId] === id) {
          return;
        }
        set({
          activeByWorkspace: {
            ...state.activeByWorkspace,
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
        const state = get();
        if (state.activeByWorkspace[workspaceId] === undefined) {
          return;
        }
        set({
          activeByWorkspace: {
            ...state.activeByWorkspace,
            [workspaceId]: undefined,
          },
        });
      },
    }),
    {
      name: "omi-workspace-tabs",
      version: 1,
    }
  )
);

export function closeResourceTabs(
  workspaceId: string,
  resourceIds: string[]
): { nextUrl: string | null } {
  const { closeTab } = useWorkspaceTabs.getState();
  let nextUrl: string | null = null;
  for (const resourceId of resourceIds) {
    const result = closeTab(workspaceId, `resource:${resourceId}`);
    if (result.wasActive) {
      nextUrl = result.nextUrl;
    }
  }
  return { nextUrl };
}

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

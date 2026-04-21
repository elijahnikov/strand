import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ResourceSectionsState {
  collapsedSections: Record<string, boolean>;
  isCollapsed: (section: string) => boolean;
  toggle: (section: string) => void;
}

export const useResourceSections = create<ResourceSectionsState>()(
  persist(
    (set, get) => ({
      collapsedSections: {},
      isCollapsed: (section: string) =>
        get().collapsedSections[section] ?? false,
      toggle: (section: string) =>
        set((state) => ({
          collapsedSections: {
            ...state.collapsedSections,
            [section]: !state.isCollapsed(section),
          },
        })),
    }),
    {
      name: "omi-resource-sections",
    }
  )
);

export function useResourceSectionsHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useResourceSections.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useResourceSections.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);
  return hydrated;
}

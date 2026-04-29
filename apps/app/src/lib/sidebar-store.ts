import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      open: true,
      setOpen: (open) => set({ open }),
      toggle: () => set({ open: !get().open }),
    }),
    {
      name: "omi-sidebar",
    }
  )
);

export function useSidebarStoreHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useSidebarStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useSidebarStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);
  return hydrated;
}

import { create } from "zustand";

export type FloatingPanelSlot = "chat" | "comments";

export const FLOATING_PANEL_WIDTH = 500;
export const FLOATING_PANEL_GAP = 16;
export const FLOATING_PANEL_BASE_RIGHT = 16;

interface FloatingPanelsState {
  // Last panel the user interacted with (focus/click). Drives Escape target.
  active: FloatingPanelSlot | null;
  closeAll: () => void;
  closePanel: (slot: FloatingPanelSlot) => void;
  // Stack ordered right-to-left: index 0 sits at the rightmost slot.
  open: FloatingPanelSlot[];
  openPanel: (slot: FloatingPanelSlot) => void;
  setActive: (slot: FloatingPanelSlot) => void;
  togglePanel: (slot: FloatingPanelSlot) => void;
}

export const useFloatingPanelsStore = create<FloatingPanelsState>(
  (set, get) => ({
    open: [],
    active: null,
    openPanel: (slot) =>
      set((state) =>
        state.open.includes(slot)
          ? { ...state, active: slot }
          : { open: [...state.open, slot], active: slot }
      ),
    closePanel: (slot) =>
      set((state) => {
        const open = state.open.filter((s) => s !== slot);
        const active =
          state.active === slot ? (open.at(-1) ?? null) : state.active;
        return { open, active };
      }),
    togglePanel: (slot) => {
      const { open, openPanel, closePanel } = get();
      if (open.includes(slot)) {
        closePanel(slot);
      } else {
        openPanel(slot);
      }
    },
    setActive: (slot) =>
      set((state) =>
        state.open.includes(slot) ? { ...state, active: slot } : state
      ),
    closeAll: () => set({ open: [], active: null }),
  })
);

export function useFloatingPanelOffset(slot: FloatingPanelSlot): number {
  return useFloatingPanelsStore((state) => {
    const idx = state.open.indexOf(slot);
    if (idx === -1) {
      return FLOATING_PANEL_BASE_RIGHT;
    }
    return (
      FLOATING_PANEL_BASE_RIGHT +
      idx * (FLOATING_PANEL_WIDTH + FLOATING_PANEL_GAP)
    );
  });
}

export function useFloatingPanelOpen(slot: FloatingPanelSlot): boolean {
  return useFloatingPanelsStore((state) => state.open.includes(slot));
}

import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ListNavItem {
  id: string;
  open: () => void;
}

export function useListNavigation(items: ListNavItem[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (activeId && !items.some((item) => item.id === activeId)) {
      setActiveId(null);
    }
  }, [items, activeId]);

  const moveBy = useCallback((delta: number) => {
    const list = itemsRef.current;
    if (list.length === 0) {
      return;
    }
    setActiveId((current) => {
      const currentIdx = current
        ? list.findIndex((item) => item.id === current)
        : -1;
      if (currentIdx === -1) {
        const fallback = delta > 0 ? list[0] : list.at(-1);
        return fallback ? fallback.id : current;
      }
      const next = Math.max(0, Math.min(list.length - 1, currentIdx + delta));
      const target = list[next];
      return target ? target.id : current;
    });
  }, []);

  useHotkey("J", () => {
    moveBy(1);
  });
  useHotkey("K", () => {
    moveBy(-1);
  });
  useHotkey("Enter", () => {
    const current = activeId;
    if (!current) {
      return;
    }
    const item = itemsRef.current.find((i) => i.id === current);
    item?.open();
  });

  return { activeId, setActiveId };
}

export function scrollActiveIntoView(container: HTMLElement | null) {
  if (!container) {
    return;
  }
  const el = container.querySelector<HTMLElement>("[data-nav-active='true']");
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

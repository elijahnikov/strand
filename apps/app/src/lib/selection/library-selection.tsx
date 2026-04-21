import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SelectionItem =
  | { id: Id<"resource">; kind: "resource" }
  | { id: Id<"collection">; kind: "collection" };

function itemKey(item: SelectionItem): string {
  return `${item.kind}:${item.id}`;
}

interface SelectionState {
  anchorKey: string | null;
  selected: Set<string>;
}

interface LibrarySelectionContextValue {
  anchorKey: string | null;
  clear: () => void;
  count: number;
  isSelected: (item: SelectionItem) => boolean;
  selectAll: (items: SelectionItem[]) => void;
  selectedCollectionIds: Id<"collection">[];
  selectedResourceIds: Id<"resource">[];
  selectRange: (
    targetItem: SelectionItem,
    orderedItems: SelectionItem[]
  ) => void;
  setAnchor: (item: SelectionItem | null) => void;
  toggle: (item: SelectionItem) => void;
}

const LibrarySelectionContext =
  createContext<LibrarySelectionContextValue | null>(null);

export function useLibrarySelection() {
  const ctx = useContext(LibrarySelectionContext);
  if (!ctx) {
    throw new Error(
      "useLibrarySelection must be used within LibrarySelectionProvider"
    );
  }
  return ctx;
}

export function LibrarySelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<SelectionState>({
    anchorKey: null,
    selected: new Set(),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const toggle = useCallback((item: SelectionItem) => {
    const key = itemKey(item);
    setState((prev) => {
      const next = new Set(prev.selected);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { anchorKey: key, selected: next };
    });
  }, []);

  const selectRange = useCallback(
    (targetItem: SelectionItem, orderedItems: SelectionItem[]) => {
      const targetKey = itemKey(targetItem);
      setState((prev) => {
        const anchor = prev.anchorKey ?? targetKey;
        const orderedKeys = orderedItems.map(itemKey);
        const anchorIdx = orderedKeys.indexOf(anchor);
        const targetIdx = orderedKeys.indexOf(targetKey);
        if (anchorIdx === -1 || targetIdx === -1) {
          const next = new Set(prev.selected);
          next.add(targetKey);
          return { anchorKey: targetKey, selected: next };
        }
        const [lo, hi] =
          anchorIdx < targetIdx
            ? [anchorIdx, targetIdx]
            : [targetIdx, anchorIdx];
        const next = new Set(prev.selected);
        for (let i = lo; i <= hi; i++) {
          const key = orderedKeys[i];
          if (key) {
            next.add(key);
          }
        }
        return { anchorKey: prev.anchorKey ?? targetKey, selected: next };
      });
    },
    []
  );

  const clear = useCallback(() => {
    setState({ anchorKey: null, selected: new Set() });
  }, []);

  const selectAll = useCallback((items: SelectionItem[]) => {
    setState((prev) => {
      const next = new Set(prev.selected);
      for (const item of items) {
        next.add(itemKey(item));
      }
      const first = items[0];
      return {
        anchorKey: first ? itemKey(first) : prev.anchorKey,
        selected: next,
      };
    });
  }, []);

  const setAnchor = useCallback((item: SelectionItem | null) => {
    setState((prev) => ({
      ...prev,
      anchorKey: item ? itemKey(item) : null,
    }));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (stateRef.current.selected.size === 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      clear();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [clear]);

  const value = useMemo<LibrarySelectionContextValue>(() => {
    const selected = state.selected;
    const selectedResourceIds: Id<"resource">[] = [];
    const selectedCollectionIds: Id<"collection">[] = [];
    for (const key of selected) {
      const idx = key.indexOf(":");
      if (idx === -1) {
        continue;
      }
      const kind = key.slice(0, idx);
      const id = key.slice(idx + 1);
      if (kind === "resource") {
        selectedResourceIds.push(id as Id<"resource">);
      } else if (kind === "collection") {
        selectedCollectionIds.push(id as Id<"collection">);
      }
    }
    return {
      anchorKey: state.anchorKey,
      clear,
      count: selected.size,
      isSelected: (item: SelectionItem) => selected.has(itemKey(item)),
      selectAll,
      selectRange,
      selectedCollectionIds,
      selectedResourceIds,
      setAnchor,
      toggle,
    };
  }, [
    state.anchorKey,
    state.selected,
    clear,
    selectAll,
    selectRange,
    setAnchor,
    toggle,
  ]);

  return (
    <LibrarySelectionContext.Provider value={value}>
      {children}
    </LibrarySelectionContext.Provider>
  );
}

export function useSelectAllHotkey(items: SelectionItem[]) {
  const { selectAll } = useLibrarySelection();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useHotkey(
    "Mod+A",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      selectAll(itemsRef.current);
    },
    { ignoreInputs: true }
  );
}

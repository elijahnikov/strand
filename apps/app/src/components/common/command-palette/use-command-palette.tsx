import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CommandPalette } from "./index";

interface CommandPaletteContextValue {
  close: () => void;
  open: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider"
    );
  }
  return ctx;
}

export function CommandPaletteProvider({
  workspaceId,
  children,
}: {
  workspaceId: Id<"workspace">;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    []
  );

  const handleOpenChange = useCallback((next: boolean) => setIsOpen(next), []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        onOpenChange={handleOpenChange}
        open={isOpen}
        workspaceId={workspaceId}
      />
    </CommandPaletteContext.Provider>
  );
}

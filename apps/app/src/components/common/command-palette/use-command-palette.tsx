import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./index";

interface CommandPaletteContextValue {
  open: () => void;
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        onOpenChange={setIsOpen}
        open={isOpen}
        workspaceId={workspaceId}
      />
    </CommandPaletteContext.Provider>
  );
}

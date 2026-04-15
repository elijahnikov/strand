import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Kbd, KbdGroup } from "@strand/ui/kbd";
import { Text } from "@strand/ui/text";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  NAV_SHORTCUTS,
  PAGE_SHORTCUTS,
  PALETTE_SHORTCUTS,
  type ShortcutSection,
} from "~/lib/hotkeys/registry";

interface ShortcutsHelpContextValue {
  close: () => void;
  open: () => void;
  toggle: () => void;
}

const ShortcutsHelpContext = createContext<ShortcutsHelpContextValue | null>(
  null
);

export function useShortcutsHelp() {
  const ctx = useContext(ShortcutsHelpContext);
  if (!ctx) {
    throw new Error(
      "useShortcutsHelp must be used within ShortcutsHelpProvider"
    );
  }
  return ctx;
}

export function ShortcutsHelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<ShortcutsHelpContextValue>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    []
  );

  return (
    <ShortcutsHelpContext.Provider value={value}>
      {children}
      <ShortcutsHelpLauncher onClick={value.open} />
      <ShortcutsHelpDialog onOpenChange={setIsOpen} open={isOpen} />
    </ShortcutsHelpContext.Provider>
  );
}

function ShortcutsHelpLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Show keyboard shortcuts"
      className="fixed bottom-3 left-4 z-40 flex size-6 items-center justify-center rounded-full border-[0.5px] bg-ui-bg-component font-medium font-mono text-[11px] text-ui-fg-muted shadow-sm transition-colors hover:bg-ui-bg-component-hover hover:text-ui-fg-base"
      onClick={onClick}
      type="button"
    >
      ?
    </button>
  );
}

function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = useMemo(() => {
    const all: { keys: string[]; label: string; section: ShortcutSection }[] = [
      ...NAV_SHORTCUTS.map(({ keys, label, section }) => ({
        keys,
        label,
        section,
      })),
      ...PALETTE_SHORTCUTS,
      ...PAGE_SHORTCUTS,
    ];
    const grouped = new Map<ShortcutSection, typeof all>();
    for (const row of all) {
      const existing = grouped.get(row.section) ?? [];
      existing.push(row);
      grouped.set(row.section, existing);
    }
    return grouped;
  }, []);

  const sectionOrder: ShortcutSection[] = ["Navigation", "Page", "Palette"];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <div>
            <DialogTitle className="font-medium text-sm">
              Keyboard shortcuts
            </DialogTitle>
          </div>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-y-6 py-8">
          {sectionOrder.map((section) => {
            const entries = rows.get(section);
            if (!entries?.length) {
              return null;
            }
            return (
              <div className="mt-4 flex flex-col gap-y-2" key={section}>
                <Text className="font-medium font-mono text-ui-fg-muted text-xs">
                  {section}
                </Text>
                <div className="flex flex-col gap-y-2">
                  {entries.map((row) => {
                    const isSequence = row.keys.length > 1;
                    return (
                      <div
                        className="flex items-center justify-between gap-x-4"
                        key={`${section}-${row.keys.join("-")}-${row.label}`}
                      >
                        <Text className="text-ui-fg-base text-xs">
                          {row.label}
                        </Text>
                        <KbdGroup>
                          {row.keys.map((key, idx) => (
                            <span
                              className="flex items-center gap-1"
                              key={`${key}-${idx.toString()}`}
                            >
                              {isSequence && idx > 0 ? (
                                <span className="text-[11px] text-ui-fg-subtle">
                                  then
                                </span>
                              ) : null}
                              <Kbd className="h-4! min-w-4 border-[0.5px] font-mono text-[10px] text-ui-fg-base">
                                {formatKey(key)}
                              </Kbd>
                            </span>
                          ))}
                        </KbdGroup>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

function formatKey(key: string): string {
  if (key === "Mod+K") {
    return "⌘K";
  }
  if (key === "Shift+/") {
    return "?";
  }
  return key;
}

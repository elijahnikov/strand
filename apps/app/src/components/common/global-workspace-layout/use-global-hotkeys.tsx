import type { Id } from "@omi/backend/_generated/dataModel.js";
import type {
  HotkeySequence,
  UseHotkeySequenceDefinition,
} from "@tanstack/react-hotkeys";
import { useHotkey, useHotkeySequences } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCommandPalette } from "~/components/common/command-palette/use-command-palette";
import { useShortcutsHelp } from "~/components/common/shortcuts-help";
import { NAV_SHORTCUTS } from "~/lib/hotkeys/registry";

export function useGlobalHotkeys({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const navigate = useNavigate();
  const commandPalette = useCommandPalette();
  const shortcutsHelp = useShortcutsHelp();

  const sequences = useMemo<UseHotkeySequenceDefinition[]>(
    () =>
      NAV_SHORTCUTS.map((shortcut) => ({
        sequence: shortcut.keys as HotkeySequence,
        callback: () => {
          navigate({ to: shortcut.path(workspaceId) });
        },
      })),
    [navigate, workspaceId]
  );

  useHotkeySequences(sequences);

  useHotkey("Mod+K", () => {
    commandPalette.toggle();
  });

  useHotkey({ key: "/", shift: true }, () => {
    shortcutsHelp.toggle();
  });
}

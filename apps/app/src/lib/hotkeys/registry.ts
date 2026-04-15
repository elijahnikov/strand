import type { Id } from "@strand/backend/_generated/dataModel.js";

export type ShortcutSection = "Navigation" | "Palette" | "Page";

export interface NavShortcut {
  keys: string[];
  label: string;
  path: (workspaceId: Id<"workspace">) => string;
  section: ShortcutSection;
}

export interface StaticShortcut {
  keys: string[];
  label: string;
  section: ShortcutSection;
}

export function workspaceBase(workspaceId: Id<"workspace">) {
  return `/workspace/${workspaceId}`;
}

export const NAV_SHORTCUTS: NavShortcut[] = [
  {
    keys: ["G", "H"],
    label: "Go to Home",
    section: "Navigation",
    path: (id) => workspaceBase(id),
  },
  {
    keys: ["G", "L"],
    label: "Go to Library",
    section: "Navigation",
    path: (id) => `${workspaceBase(id)}/library`,
  },
  {
    keys: ["G", "S"],
    label: "Go to Search",
    section: "Navigation",
    path: (id) => `${workspaceBase(id)}/search`,
  },
  {
    keys: ["G", "C"],
    label: "Go to Chat",
    section: "Navigation",
    path: (id) => `${workspaceBase(id)}/chat`,
  },
  {
    keys: ["G", "T"],
    label: "Go to Tags",
    section: "Navigation",
    path: (id) => `${workspaceBase(id)}/tags`,
  },
  {
    keys: ["G", ","],
    label: "Go to Settings",
    section: "Navigation",
    path: (id) => `${workspaceBase(id)}/settings`,
  },
];

const NAV_SHORTCUT_BY_TITLE: Record<string, string[]> = {
  Home: ["G", "H"],
  Library: ["G", "L"],
  Search: ["G", "S"],
  Chat: ["G", "C"],
  Tags: ["G", "T"],
  Settings: ["G", ","],
};

export function getNavShortcutByTitle(title: string): string[] | undefined {
  return NAV_SHORTCUT_BY_TITLE[title];
}

export const PALETTE_SHORTCUTS: StaticShortcut[] = [
  { keys: ["Mod+K"], label: "Open command palette", section: "Palette" },
  { keys: ["Shift+/"], label: "Show keyboard shortcuts", section: "Palette" },
  { keys: ["Escape"], label: "Close dialog", section: "Palette" },
];

export const PAGE_SHORTCUTS: StaticShortcut[] = [
  { keys: ["j"], label: "Move down in list", section: "Page" },
  { keys: ["k"], label: "Move up in list", section: "Page" },
  { keys: ["Enter"], label: "Open focused item", section: "Page" },
  { keys: ["Shift+C"], label: "Toggle resource chat", section: "Page" },
  { keys: ["Mod+1…9"], label: "Switch to tab 1–9", section: "Page" },
  { keys: ["Mod+0"], label: "Switch to last tab", section: "Page" },
];

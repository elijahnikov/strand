const MAX_RECENT = 10;
const STORAGE_PREFIX = "omi.search.recent.";

export interface RecentSearchFilterSummary {
  collectionId?: string | null;
  conceptIds?: string[];
  dateFrom?: number;
  dateTo?: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  language?: string;
  sentiment?: string;
  tagIds?: string[];
  types?: string[];
}

export interface RecentSearch {
  at: number;
  filters: RecentSearchFilterSummary;
  q: string;
}

function storageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dedupeKey(q: string): string {
  return q.trim().toLowerCase();
}

export function loadRecent(workspaceId: string): RecentSearch[] {
  const storage = safeStorage();
  if (!storage) {
    return [];
  }
  const raw = storage.getItem(storageKey(workspaceId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const valid = parsed.filter(
      (item): item is RecentSearch =>
        typeof item === "object" &&
        item !== null &&
        typeof item.q === "string" &&
        typeof item.at === "number" &&
        typeof item.filters === "object"
    );
    const seen = new Set<string>();
    const deduped: RecentSearch[] = [];
    for (const item of valid) {
      const key = dedupeKey(item.q);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  } catch {
    return [];
  }
}

export function recordSearch(
  workspaceId: string,
  q: string,
  filters: RecentSearchFilterSummary
): void {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    return;
  }
  const current = loadRecent(workspaceId);
  const key = dedupeKey(trimmed);
  const deduped = current.filter((item) => dedupeKey(item.q) !== key);
  const next: RecentSearch[] = [
    { q: trimmed, filters, at: Date.now() },
    ...deduped,
  ].slice(0, MAX_RECENT);
  try {
    storage.setItem(storageKey(workspaceId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export function clearRecent(workspaceId: string): void {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(storageKey(workspaceId));
  } catch {
    // ignore
  }
}

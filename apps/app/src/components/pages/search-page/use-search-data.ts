import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import type { SearchSort, SearchType } from "./use-search-filters";

const DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 50;
const STALE_TIME_MS = 30_000;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface SearchDataArgs {
  collectionId: Id<"collection"> | null;
  conceptIds: Id<"concept">[];
  dateFrom: number | null;
  dateTo: number | null;
  enabled: boolean;
  isFavorite: boolean | null;
  isPinned: boolean | null;
  language: string | null;
  q: string;
  sentiment: string | null;
  sort: SearchSort;
  tagIds: Id<"tag">[];
  types: SearchType[] | null;
  workspaceId: Id<"workspace">;
}

export function useSearchData(args: SearchDataArgs) {
  const hybridSearch = useAction(api.search.actions.hybridSearch);
  const debouncedQ = useDebounced(args.q, DEBOUNCE_MS);

  const filters = {
    types: args.types?.length ? args.types : undefined,
    conceptIds: args.conceptIds.length > 0 ? args.conceptIds : undefined,
    tagIds: args.tagIds.length > 0 ? args.tagIds : undefined,
    collectionId: args.collectionId === null ? undefined : args.collectionId,
    isPinned: args.isPinned ?? undefined,
    isFavorite: args.isFavorite ?? undefined,
    sentiment: args.sentiment ?? undefined,
    language: args.language ?? undefined,
    dateFrom: args.dateFrom ?? undefined,
    dateTo: args.dateTo ?? undefined,
  };

  const queryKey = [
    "hybridSearch",
    args.workspaceId,
    debouncedQ,
    args.sort,
    filters,
  ] as const;

  const query = useQuery({
    queryKey,
    enabled: args.enabled,
    staleTime: STALE_TIME_MS,
    queryFn: () =>
      hybridSearch({
        workspaceId: args.workspaceId,
        query: debouncedQ,
        filters,
        sort: args.sort,
        limit: SEARCH_LIMIT,
      }),
  });

  const isStaleInput = args.q.trim() !== debouncedQ.trim();

  return { ...query, isStaleInput };
}

export { useDebounced };

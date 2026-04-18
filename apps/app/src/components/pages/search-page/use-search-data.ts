import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import {
  type DateOperator,
  type ListOperator,
  NO_COLLECTION_SENTINEL,
  type SearchEmbedType,
  type SearchSort,
  type SearchType,
} from "./use-search-filters";

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
  /** May be an `Id<"collection">`, the `NO_COLLECTION_SENTINEL`, or null when no filter is active. */
  collectionId: string | null;
  collectionOp: ListOperator | null;
  conceptIds: Id<"concept">[];
  conceptOp: ListOperator | null;
  createdByIds: Id<"user">[];
  createdByOp: ListOperator | null;
  dateFrom: number | null;
  dateOp: DateOperator | null;
  dateTo: number | null;
  embedTypeOp: ListOperator | null;
  embedTypes: SearchEmbedType[] | null;
  enabled: boolean;
  isFavorite: boolean | null;
  isPinned: boolean | null;
  language: string | null;
  q: string;
  sentiment: string | null;
  sort: SearchSort;
  tagIds: Id<"tag">[];
  tagOp: ListOperator | null;
  typeOp: ListOperator | null;
  types: SearchType[] | null;
  workspaceId: Id<"workspace">;
}

export function useSearchData(args: SearchDataArgs) {
  const hybridSearch = useAction(api.search.actions.hybridSearch);
  const debouncedQ = useDebounced(args.q, DEBOUNCE_MS);

  const filters = {
    types: args.types?.length ? args.types : undefined,
    typesOp: args.types?.length ? (args.typeOp ?? undefined) : undefined,
    embedTypes: args.embedTypes?.length ? args.embedTypes : undefined,
    embedTypesOp: args.embedTypes?.length
      ? (args.embedTypeOp ?? undefined)
      : undefined,
    conceptIds: args.conceptIds.length > 0 ? args.conceptIds : undefined,
    conceptIdsOp:
      args.conceptIds.length > 0 ? (args.conceptOp ?? undefined) : undefined,
    tagIds: args.tagIds.length > 0 ? args.tagIds : undefined,
    tagIdsOp: args.tagIds.length > 0 ? (args.tagOp ?? undefined) : undefined,
    createdBy: args.createdByIds.length > 0 ? args.createdByIds : undefined,
    createdByOp:
      args.createdByIds.length > 0
        ? (args.createdByOp ?? undefined)
        : undefined,
    collectionId:
      args.collectionId === null
        ? undefined
        : args.collectionId === NO_COLLECTION_SENTINEL
          ? null
          : (args.collectionId as Id<"collection">),
    collectionIdOp:
      args.collectionId === null ? undefined : (args.collectionOp ?? undefined),
    isPinned: args.isPinned ?? undefined,
    isFavorite: args.isFavorite ?? undefined,
    sentiment: args.sentiment ?? undefined,
    language: args.language ?? undefined,
    dateFrom: args.dateFrom ?? undefined,
    dateTo: args.dateTo ?? undefined,
    dateOp:
      args.dateFrom !== null || args.dateTo !== null
        ? (args.dateOp ?? undefined)
        : undefined,
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

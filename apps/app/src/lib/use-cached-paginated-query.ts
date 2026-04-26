import { convexQuery } from "@convex-dev/react-query";
import { useQueries } from "@tanstack/react-query";
import type {
  FunctionArgs,
  FunctionReference,
  PaginationResult,
} from "convex/server";
import { useCallback, useMemo, useRef, useState } from "react";

export type CachedPaginationStatus =
  | "LoadingFirstPage"
  | "LoadingMore"
  | "CanLoadMore"
  | "Exhausted";

type PaginatedQueryRef = FunctionReference<
  "query",
  "public",
  // biome-ignore lint/suspicious/noExplicitAny: generic over any args
  any,
  // biome-ignore lint/suspicious/noExplicitAny: generic over any page item
  PaginationResult<any>
>;

type PaginatedArgs<Q extends PaginatedQueryRef> = Omit<
  FunctionArgs<Q>,
  "paginationOpts"
>;

type PaginatedItem<Q extends PaginatedQueryRef> =
  FunctionArgs<Q> extends infer _A
    ? Q extends FunctionReference<
        "query",
        "public",
        // biome-ignore lint/suspicious/noExplicitAny: <>
        any,
        PaginationResult<infer Item>
      >
      ? Item
      : never
    : never;

/**
 * Drop-in alternative to `useConvexPaginatedQuery` that routes every page
 * through TanStack Query so each page is independently cached, prefetchable
 * via route loaders, and survives back-navigation.
 *
 * Each cursor → its own queryKey. Filter changes (anything in `args`) reset
 * the cursor chain to `[null]` synchronously via the prev-key compare pattern.
 */
export function useCachedPaginatedQuery<Q extends PaginatedQueryRef>(
  query: Q,
  args: PaginatedArgs<Q>,
  pageSize: number
) {
  const filterKey = JSON.stringify(args);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const prevKeyRef = useRef(filterKey);
  if (prevKeyRef.current !== filterKey) {
    prevKeyRef.current = filterKey;
    setCursors([null]);
  }

  const queriesConfig = useMemo(
    () =>
      cursors.map((cursor) =>
        convexQuery(query, {
          ...args,
          paginationOpts: { numItems: pageSize, cursor },
        } as FunctionArgs<Q>)
      ),
    [cursors, query, args, pageSize]
  );

  const queries = useQueries({
    // biome-ignore lint/suspicious/noExplicitAny: useQueries wants a tuple, but we have a homogeneous array
    queries: queriesConfig as any[],
  });

  const results = useMemo(() => {
    const out: PaginatedItem<Q>[] = [];
    for (const q of queries) {
      const data = q.data as PaginationResult<PaginatedItem<Q>> | undefined;
      if (data?.page) {
        out.push(...data.page);
      }
    }
    return out;
  }, [queries]);

  const lastQuery = queries.at(-1);
  const lastData = lastQuery?.data as
    | PaginationResult<PaginatedItem<Q>>
    | undefined;

  const isFirstLoading =
    queries.length === 1 && queries[0]?.isLoading && !queries[0]?.data;
  const isLoadingMore = !!(lastQuery?.isLoading && queries.length > 1);

  let status: CachedPaginationStatus;
  if (isFirstLoading) {
    status = "LoadingFirstPage";
  } else if (isLoadingMore) {
    status = "LoadingMore";
  } else if (lastData?.isDone) {
    status = "Exhausted";
  } else {
    status = "CanLoadMore";
  }

  const loadMore = useCallback(
    (_count: number) => {
      if (status !== "CanLoadMore") {
        return;
      }
      const cursor = lastData?.continueCursor;
      if (!cursor) {
        return;
      }
      setCursors((prev) => {
        if (prev.at(-1) === cursor) {
          return prev;
        }
        return [...prev, cursor];
      });
    },
    [status, lastData?.continueCursor]
  );

  return { results, status, loadMore };
}

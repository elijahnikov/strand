import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { SelectionDock } from "~/components/common/selection-dock";
import {
  type ListNavItem,
  useListNavigation,
} from "~/lib/hotkeys/use-list-navigation";
import {
  type SelectionItem,
  useSelectAllHotkey,
} from "~/lib/selection/library-selection";
import { ResourceRow } from "../library-page/resource-row";
import { SelectableRow } from "../library-page/selectable-resource-row";
import { SearchEmpty } from "./search-empty";

type HybridSearch = FunctionReturnType<typeof api.search.actions.hybridSearch>;
export type SearchResultItem = HybridSearch["results"][number];

export function SearchResults({
  workspaceId,
  results,
  isLoading,
  isStaleInput,
  query,
  hasActiveFilters,
  stats,
}: {
  workspaceId: Id<"workspace">;
  results: SearchResultItem[] | undefined;
  isLoading: boolean;
  isStaleInput: boolean;
  query: string;
  hasActiveFilters: boolean;
  stats?: {
    titleHits: number;
    semanticHits: number;
    chunkHits: number;
    conceptHits: number;
    tagHits: number;
    totalCandidates: number;
  };
  usedFallback: boolean;
}) {
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if ((results?.length ?? 0) > 0) {
      initialLoadDone.current = true;
    }
  }, [results?.length]);

  const { data: serverPinned } = useQuery(
    convexQuery(api.resource.queries.listPinned, { workspaceId })
  );
  const pinnedIdSet = useMemo(
    () => new Set((serverPinned ?? []).map((r) => r._id)),
    [serverPinned]
  );

  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });
  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });
  const { mutate: removeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });
  const { mutate: restoreMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
  });

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );
  const handleTogglePin = useCallback(
    (resourceId: Id<"resource">) => {
      togglePin({ resourceId, workspaceId });
    },
    [togglePin, workspaceId]
  );
  const handleDelete = useCallback(
    (resourceId: Id<"resource">) => {
      removeMany({ workspaceId, resourceIds: [resourceId] });
      toastManager.add({
        type: "success",
        title: "Deleted",
        actionProps: {
          children: "Undo",
          onClick: () => {
            restoreMany({ workspaceId, resourceIds: [resourceId] });
          },
        },
      });
    },
    [removeMany, restoreMany, workspaceId]
  );

  const orderedItems = useMemo<SelectionItem[]>(
    () =>
      (results ?? []).map((r) => ({
        kind: "resource" as const,
        id: r.resourceId,
      })),
    [results]
  );

  const navigate = useNavigate();
  const navItems = useMemo<ListNavItem[]>(
    () =>
      (results ?? []).map((r) => ({
        id: `res-${r.resourceId}`,
        open: () =>
          navigate({
            to: "/workspace/$workspaceId/resource/$resourceId",
            params: { workspaceId, resourceId: r.resourceId },
          }),
      })),
    [results, navigate, workspaceId]
  );

  const { activeId } = useListNavigation(navItems);

  useSelectAllHotkey(orderedItems);

  const showSkeleton =
    (isLoading || isStaleInput) && (results?.length ?? 0) === 0;

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-y-1 pt-2">
        <div className="px-1 pb-1">
          <Skeleton className="h-3 w-20" />
        </div>
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton className="h-13 w-full" key={i.toString()} />
        ))}
      </div>
    );
  }

  if (results && results.length === 0) {
    return <SearchEmpty hasActiveFilters={hasActiveFilters} query={query} />;
  }

  if (!results) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-1 pt-2">
      {stats ? (
        <div className="flex items-center gap-x-2 px-1 pb-1 text-[11px] text-ui-fg-muted">
          <Text className="font-medium font-mono text-[11px]">
            {results.length} result{results.length === 1 ? "" : "s"}
          </Text>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {results.map((result, i) => {
          const navId = `res-${result.resourceId}`;
          const isActive = activeId === navId;
          return (
            <SelectableRow
              item={{ kind: "resource", id: result.resourceId }}
              key={result.resourceId}
              orderedItems={orderedItems}
            >
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-lg",
                  isActive && "ring-2 ring-ui-fg-interactive ring-inset"
                )}
                data-nav-active={isActive || undefined}
                exit={{ opacity: 0, height: 0 }}
                initial={initialLoadDone.current ? false : { opacity: 0, y: 8 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                  delay: initialLoadDone.current ? 0 : i * 0.02,
                }}
              >
                <MemoizedRow
                  isPinned={pinnedIdSet.has(result.resourceId)}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                  onUpdateTitle={handleUpdateTitle}
                  result={result}
                  workspaceId={workspaceId}
                />
              </motion.div>
            </SelectableRow>
          );
        })}
      </AnimatePresence>
      <SelectionDock workspaceId={workspaceId} />
    </div>
  );
}

const MemoizedRow = memo(function MemoizedRow({
  result,
  workspaceId,
  isPinned,
  onUpdateTitle,
  onTogglePin,
  onDelete,
}: {
  result: SearchResultItem;
  workspaceId: Id<"workspace">;
  isPinned: boolean;
  onUpdateTitle: (id: Id<"resource">, title: string) => void;
  onTogglePin: (id: Id<"resource">) => void;
  onDelete: (id: Id<"resource">) => void;
}) {
  return (
    <ResourceRow
      isPinned={isPinned}
      onDelete={onDelete}
      onTogglePin={onTogglePin}
      onUpdateTitle={onUpdateTitle}
      resource={
        result.resource as Parameters<typeof ResourceRow>[0]["resource"]
      }
      snippet={result.bestSnippet ?? undefined}
      workspaceId={workspaceId}
    />
  );
});

import { RiMosaicLine } from "@remixicon/react";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { ArrowUpDownIcon } from "lucide-react";
import { useState } from "react";
import {
  type SearchSort,
  SORT_VALUES,
  useSearchFilters,
} from "../use-search-filters";
import { AddFilterMenu } from "./add-filter-menu";
import { FilterChip } from "./filter-chip";
import { FILTER_CONFIGS, type FilterId } from "./filter-registry";

const SORT_LABELS: Record<SearchSort, string> = {
  relevance: "Relevance",
  newest: "Newest",
  oldest: "Oldest",
  "recently-updated": "Recently updated",
  alphabetical: "A → Z",
};

export function FilterBar({
  workspaceId,
  onReset,
  hasActiveFilters,
}: {
  workspaceId: Id<"workspace">;
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  const { sort, setSort } = useSearchFilters();
  const [pendingNewFilter, setPendingNewFilter] = useState<FilterId | null>(
    null
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTER_CONFIGS.map((config) => (
        <MaybeChip
          creating={pendingNewFilter === config.id}
          filterId={config.id}
          key={config.id}
          onCreatingDone={() => setPendingNewFilter(null)}
          onSwap={setPendingNewFilter}
          workspaceId={workspaceId}
        />
      ))}
      <Button
        className="size-8! h-8 gap-x-1.5 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs"
        size="small"
        variant="omi"
      >
        <RiMosaicLine className="size-4.5 shrink-0" />
      </Button>
      <AddFilterMenu workspaceId={workspaceId} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="size-8! h-8 gap-x-1.5 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs"
              size="small"
              variant="secondary"
            />
          }
        >
          <ArrowUpDownIcon className="size-3.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SORT_VALUES.map((value) => (
            <DropdownMenuItem
              className={cn(
                sort === value && "bg-ui-bg-component-hover text-ui-fg-base"
              )}
              key={value}
              onClick={() => setSort(value)}
            >
              {SORT_LABELS[value]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {hasActiveFilters ? (
        <Button
          className="h-8 whitespace-nowrap rounded-full px-3 text-ui-fg-muted text-xs"
          onClick={onReset}
          size="small"
          variant="ghost"
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function MaybeChip({
  filterId,
  workspaceId,
  creating,
  onSwap,
  onCreatingDone,
}: {
  filterId: FilterId;
  workspaceId: Id<"workspace">;
  creating: boolean;
  onSwap: (to: FilterId) => void;
  onCreatingDone: () => void;
}) {
  const config = FILTER_CONFIGS.find((c) => c.id === filterId);
  const isActive = config?.useIsActive() ?? false;
  if (!(config && (isActive || creating))) {
    return null;
  }
  return (
    <FilterChip
      creating={creating}
      filterId={filterId}
      onCreatingDone={onCreatingDone}
      onSwap={onSwap}
      workspaceId={workspaceId}
    />
  );
}

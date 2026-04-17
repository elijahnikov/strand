import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Badge } from "@strand/ui/badge";
import { Button } from "@strand/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  FileIcon,
  GlobeIcon,
  StickyNoteIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";
import {
  type SearchSort,
  type SearchType,
  SORT_VALUES,
  TYPE_VALUES,
} from "./use-search-filters";

const SORT_LABELS: Record<SearchSort, string> = {
  relevance: "Relevance",
  newest: "Newest",
  oldest: "Oldest",
  "recently-updated": "Recently updated",
  alphabetical: "A → Z",
};

const TYPE_META: Record<SearchType, { label: string; Icon: typeof GlobeIcon }> =
  {
    website: { label: "Websites", Icon: GlobeIcon },
    note: { label: "Notes", Icon: StickyNoteIcon },
    file: { label: "Files", Icon: FileIcon },
  };

interface ConceptSummary {
  _id: Id<"concept">;
  name: string;
}
interface TagSummary {
  _id: Id<"tag">;
  color?: string;
  name: string;
}

export function SearchFilterControls({
  types,
  setTypes,
  sort,
  setSort,
  onReset,
  hasActiveFilters,
}: {
  types: SearchType[] | null;
  setTypes: (next: SearchType[] | null) => void;
  sort: SearchSort;
  setSort: (next: SearchSort | null) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  const toggleType = (type: SearchType) => {
    const current = types ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setTypes(next.length === 0 ? null : next);
  };

  const isAllActive = !types || types.length === 0;

  return (
    <div className="flex items-center gap-x-1">
      <Button
        className={cn(
          "h-8 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs",
          isAllActive
            ? "bg-ui-bg-component"
            : "border-transparent! bg-transparent! hover:bg-ui-bg-base-hover!"
        )}
        onClick={() => setTypes(null)}
        size="small"
        variant="secondary"
      >
        All
      </Button>
      {TYPE_VALUES.map((type) => {
        const meta = TYPE_META[type];
        const isActive = types?.includes(type) ?? false;
        return (
          <Button
            className={cn(
              "h-8 gap-x-1.5 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs",
              isActive
                ? "bg-ui-bg-component"
                : "border-transparent! bg-transparent! hover:bg-ui-bg-base-hover!"
            )}
            key={type}
            onClick={() => toggleType(type)}
            size="small"
            variant="secondary"
          >
            <meta.Icon className="size-3.5 shrink-0" />
            {meta.label}
          </Button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="h-8 gap-x-1.5 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs"
              size="small"
              variant="secondary"
            />
          }
        >
          <ArrowUpDownIcon className="size-3" />
          {SORT_LABELS[sort]}
          <ChevronDownIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SORT_VALUES.map((value) => (
            <DropdownMenuItem key={value} onClick={() => setSort(value)}>
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

export function SearchActiveChips({
  workspaceId,
  conceptIds,
  setConceptIds,
  tagIds,
  setTagIds,
}: {
  workspaceId: Id<"workspace">;
  conceptIds: Id<"concept">[];
  setConceptIds: (next: Id<"concept">[] | null) => void;
  tagIds: Id<"tag">[];
  setTagIds: (next: Id<"tag">[] | null) => void;
}) {
  const hasConceptFilters = conceptIds.length > 0;
  const hasTagFilters = tagIds.length > 0;

  const { data: topConcepts } = useQuery(
    convexQuery(
      api.search.queries.listTopConcepts,
      hasConceptFilters ? { workspaceId } : "skip"
    )
  );

  const { data: topTags } = useQuery(
    convexQuery(
      api.search.queries.listTopTags,
      hasTagFilters ? { workspaceId } : "skip"
    )
  );

  const conceptLookup = useMemo(() => {
    const map = new Map<Id<"concept">, ConceptSummary>();
    for (const concept of topConcepts ?? []) {
      map.set(concept._id, concept);
    }
    return map;
  }, [topConcepts]);

  const tagLookup = useMemo(() => {
    const map = new Map<Id<"tag">, TagSummary>();
    for (const tag of topTags ?? []) {
      map.set(tag._id, tag);
    }
    return map;
  }, [topTags]);

  const removeConcept = (id: Id<"concept">) => {
    const next = conceptIds.filter((c) => c !== id);
    setConceptIds(next.length === 0 ? null : next);
  };

  const removeTag = (id: Id<"tag">) => {
    const next = tagIds.filter((t) => t !== id);
    setTagIds(next.length === 0 ? null : next);
  };

  if (!(hasConceptFilters || hasTagFilters)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {conceptIds.map((id) => {
        const concept = conceptLookup.get(id);
        return (
          <Badge
            className="h-6 cursor-pointer gap-x-1 rounded-full pr-1 pl-2"
            key={id}
            variant="mono"
          >
            <span className="text-[11px]">{concept?.name ?? "concept"}</span>
            <button
              aria-label={`Remove concept ${concept?.name ?? ""}`}
              className="flex size-4 items-center justify-center rounded-full text-ui-fg-muted hover:bg-ui-bg-component hover:text-ui-fg-base"
              onClick={() => removeConcept(id)}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        );
      })}
      {tagIds.map((id) => {
        const tag = tagLookup.get(id);
        return (
          <Badge
            className="h-6 gap-x-1 rounded-full pr-1 pl-2"
            key={id}
            variant="outline"
          >
            <span className="text-[10px] text-ui-fg-muted">#</span>
            <span className="text-[11px]">{tag?.name ?? "tag"}</span>
            <button
              aria-label={`Remove tag ${tag?.name ?? ""}`}
              className="flex size-4 items-center justify-center rounded-full text-ui-fg-muted hover:bg-ui-bg-component hover:text-ui-fg-base"
              onClick={() => removeTag(id)}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchFilters } from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

export function ConceptPicker({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { conceptIds, setConceptIds } = useSearchFilters();
  const { data: concepts } = useQuery(
    convexQuery(api.search.queries.listTopConcepts, {
      workspaceId,
      limit: 100,
    })
  );

  const items = useMemo(
    () =>
      (concepts ?? []).map((c) => ({
        id: c._id as string,
        label: c.name,
        sublabel: `${c.count}`,
      })),
    [concepts]
  );

  return (
    <MultiSelectPicker
      emptyMessage="No concepts."
      items={items}
      onChange={(next) => {
        const typed = next as Id<"concept">[];
        setConceptIds(typed.length === 0 ? null : typed);
      }}
      searchPlaceholder="Search concepts…"
      selectedIds={conceptIds}
    />
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchFilters } from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

export function TagPicker({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { tagIds, setTagIds } = useSearchFilters();
  const { data: tags } = useQuery(
    convexQuery(api.search.queries.listTopTags, { workspaceId, limit: 100 })
  );

  const items = useMemo(
    () =>
      (tags ?? []).map((t) => ({
        id: t._id as string,
        label: t.name,
        sublabel: `${t.count}`,
      })),
    [tags]
  );

  return (
    <MultiSelectPicker
      emptyMessage="No tags."
      items={items}
      onChange={(next) => {
        const typed = next as Id<"tag">[];
        setTagIds(typed.length === 0 ? null : typed);
      }}
      searchPlaceholder="Search tags…"
      selectedIds={tagIds}
    />
  );
}

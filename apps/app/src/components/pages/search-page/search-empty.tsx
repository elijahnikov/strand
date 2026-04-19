import { RiSearchLine } from "@remixicon/react";
import { EmptyState } from "~/components/common/empty-state";

export function SearchEmpty({
  query,
  hasActiveFilters,
}: {
  query: string;
  hasActiveFilters: boolean;
}) {
  return (
    <EmptyState
      description={
        hasActiveFilters
          ? "Try removing a filter or broadening your query."
          : "Try broader terms. Full-text search matches titles; AI-enhanced results may take a moment."
      }
      Icon={RiSearchLine}
      title={
        query ? `No results for "${query}"` : "No results match your filters"
      }
    />
  );
}

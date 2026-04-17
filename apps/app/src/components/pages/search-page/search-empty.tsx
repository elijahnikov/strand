import { Heading } from "@strand/ui/heading";
import { Text } from "@strand/ui/text";

export function SearchEmpty({
  query,
  hasActiveFilters,
}: {
  query: string;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Heading className="font-medium text-sm text-ui-fg-subtle">
        {query ? `No results for "${query}"` : "No results match your filters"}
      </Heading>
      <Text className="mt-2 max-w-sm text-ui-fg-muted text-xs">
        {hasActiveFilters
          ? "Try removing a filter or broadening your query."
          : "Try broader terms. Full-text search matches titles; AI-enhanced results may take a moment."}
      </Text>
    </div>
  );
}

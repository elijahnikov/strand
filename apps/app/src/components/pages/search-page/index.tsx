import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useEffect, useRef } from "react";
import { PageContent } from "~/components/common/page-content";
import { recordSearch } from "~/lib/search/recent-searches";
import { LibrarySelectionProvider } from "~/lib/selection/library-selection";
import { SearchActiveChips, SearchFilterControls } from "./search-filters";
import { SearchInput } from "./search-input";
import { SearchResults } from "./search-results";
import { SearchSuggestions } from "./search-suggestions";
import { useSearchData } from "./use-search-data";
import { clearAllFilters, useSearchFilters } from "./use-search-filters";

export function SearchPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const filters = useSearchFilters();
  const {
    q,
    setQ,
    types,
    setTypes,
    conceptIds,
    setConceptIds,
    tagIds,
    setTagIds,
    collectionId,
    setCollectionId,
    sort,
    setSort,
    isPinned,
    setIsPinned,
    isFavorite,
    setIsFavorite,
    sentiment,
    setSentiment,
    language,
    setLanguage,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasActiveFilters,
  } = filters;

  const trimmedQ = q.trim();
  const enabled = trimmedQ.length > 0 || hasActiveFilters;

  const { data, isPending, isFetching, isStaleInput } = useSearchData({
    workspaceId,
    q,
    types,
    conceptIds,
    tagIds,
    collectionId,
    sort,
    isPinned,
    isFavorite,
    sentiment,
    language,
    dateFrom,
    dateTo,
    enabled,
  });

  const recordedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data || data.results.length === 0) {
      return;
    }
    if (trimmedQ.length < 2) {
      return;
    }
    const signature = `${trimmedQ}|${JSON.stringify({
      types,
      conceptIds,
      tagIds,
      collectionId,
      sort,
      isPinned,
      isFavorite,
      sentiment,
      language,
      dateFrom,
      dateTo,
    })}`;
    if (recordedSignatureRef.current === signature) {
      return;
    }
    const id = setTimeout(() => {
      recordSearch(workspaceId, trimmedQ, {
        types: types ?? undefined,
        conceptIds:
          conceptIds.length > 0
            ? (conceptIds as unknown as string[])
            : undefined,
        tagIds: tagIds.length > 0 ? (tagIds as unknown as string[]) : undefined,
        collectionId: collectionId ?? undefined,
        isPinned: isPinned ?? undefined,
        isFavorite: isFavorite ?? undefined,
        sentiment: sentiment ?? undefined,
        language: language ?? undefined,
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
      });
      recordedSignatureRef.current = signature;
    }, 1000);
    return () => clearTimeout(id);
  }, [
    data,
    trimmedQ,
    types,
    conceptIds,
    tagIds,
    collectionId,
    sort,
    isPinned,
    isFavorite,
    sentiment,
    language,
    dateFrom,
    dateTo,
    workspaceId,
  ]);

  const handleReset = () => {
    clearAllFilters({
      setTypes,
      setConceptIds,
      setTagIds,
      setCollectionId,
      setSort,
      setIsPinned,
      setIsFavorite,
      setSentiment,
      setLanguage,
      setDateFrom,
      setDateTo,
    });
  };

  const handleConceptClick = (conceptId: Id<"concept">) => {
    if (conceptIds.includes(conceptId)) {
      return;
    }
    setConceptIds([...conceptIds, conceptId]);
  };

  return (
    <LibrarySelectionProvider>
      <div className="fixed inset-x-0 top-11 z-30 flex w-full items-center gap-x-2 bg-ui-bg-base! p-2 md:sticky md:inset-x-auto md:top-0 md:rounded-t-lg">
        <SearchInput
          isPending={enabled && (isPending || isFetching)}
          onChange={setQ}
          value={q}
        />
        <div className="ml-auto flex items-center gap-x-2 overflow-x-auto">
          <SearchFilterControls
            hasActiveFilters={hasActiveFilters}
            onReset={handleReset}
            setSort={setSort}
            setTypes={setTypes}
            sort={sort}
            types={types}
          />
        </div>
      </div>
      <PageContent className="pt-14 pb-24 md:pt-2" width="xl:w-3/5">
        <SearchActiveChips
          conceptIds={conceptIds}
          setConceptIds={setConceptIds}
          setTagIds={setTagIds}
          tagIds={tagIds}
          workspaceId={workspaceId}
        />

        {enabled ? (
          <SearchResults
            hasActiveFilters={hasActiveFilters}
            isLoading={isPending}
            isStaleInput={isStaleInput}
            query={trimmedQ}
            results={data?.results}
            stats={data?.stats}
            usedFallback={data?.usedFallback ?? false}
            workspaceId={workspaceId}
          />
        ) : (
          <SearchSuggestions
            onPickConcept={handleConceptClick}
            onPickRecent={(recent) => {
              setQ(recent.q);
              if (recent.filters.types) {
                setTypes(
                  recent.filters.types as Parameters<typeof setTypes>[0]
                );
              }
              if (recent.filters.conceptIds?.length) {
                setConceptIds(
                  recent.filters.conceptIds as unknown as Id<"concept">[]
                );
              }
              if (recent.filters.tagIds?.length) {
                setTagIds(recent.filters.tagIds as unknown as Id<"tag">[]);
              }
            }}
            workspaceId={workspaceId}
          />
        )}
      </PageContent>
    </LibrarySelectionProvider>
  );
}

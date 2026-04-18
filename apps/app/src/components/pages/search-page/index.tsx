import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useEffect, useRef } from "react";
import { PageContent } from "~/components/common/page-content";
import { recordSearch } from "~/lib/search/recent-searches";
import { LibrarySelectionProvider } from "~/lib/selection/library-selection";
import { FilterBar } from "./filters/filter-bar";
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
    typeOp,
    setTypeOp,
    embedTypes,
    setEmbedTypes,
    embedTypeOp,
    setEmbedTypeOp,
    conceptIds,
    setConceptIds,
    conceptOp,
    setConceptOp,
    tagIds,
    setTagIds,
    tagOp,
    setTagOp,
    createdByIds,
    setCreatedByIds,
    createdByOp,
    setCreatedByOp,
    collectionId,
    setCollectionId,
    collectionOp,
    setCollectionOp,
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
    dateOp,
    setDateOp,
    hasActiveFilters,
  } = filters;

  const trimmedQ = q.trim();
  const enabled = trimmedQ.length > 0 || hasActiveFilters;

  const { data, isPending, isFetching, isStaleInput } = useSearchData({
    workspaceId,
    q,
    types,
    typeOp,
    embedTypes,
    embedTypeOp,
    conceptIds,
    conceptOp,
    tagIds,
    tagOp,
    createdByIds,
    createdByOp,
    collectionId,
    collectionOp,
    sort,
    isPinned,
    isFavorite,
    sentiment,
    language,
    dateFrom,
    dateTo,
    dateOp,
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
      setTypeOp,
      setEmbedTypes,
      setEmbedTypeOp,
      setConceptIds,
      setConceptOp,
      setTagIds,
      setTagOp,
      setCreatedByIds,
      setCreatedByOp,
      setCollectionId,
      setCollectionOp,
      setSort,
      setIsPinned,
      setIsFavorite,
      setSentiment,
      setLanguage,
      setDateFrom,
      setDateTo,
      setDateOp,
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
          <FilterBar
            hasActiveFilters={hasActiveFilters}
            onReset={handleReset}
            workspaceId={workspaceId}
          />
        </div>
      </div>
      <PageContent className="pt-14 pb-24 md:pt-2" width="xl:w-3/5">
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

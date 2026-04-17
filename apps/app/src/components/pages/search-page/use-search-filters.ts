import type { Id } from "@strand/backend/_generated/dataModel.js";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";

export const TYPE_VALUES = ["website", "note", "file"] as const;
export type SearchType = (typeof TYPE_VALUES)[number];

export const SORT_VALUES = [
  "relevance",
  "newest",
  "oldest",
  "recently-updated",
  "alphabetical",
] as const;
export type SearchSort = (typeof SORT_VALUES)[number];

const typeParser = parseAsArrayOf(parseAsStringLiteral(TYPE_VALUES));
const idParser = parseAsArrayOf(parseAsString);

export function useSearchFilters() {
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [types, setTypes] = useQueryState(
    "type",
    typeParser.withOptions({ shallow: false })
  );
  const [conceptIds, setConceptIds] = useQueryState(
    "concepts",
    idParser.withOptions({ shallow: false })
  );
  const [tagIds, setTagIds] = useQueryState(
    "tags",
    idParser.withOptions({ shallow: false })
  );
  const [collectionId, setCollectionId] = useQueryState(
    "collection",
    parseAsString.withOptions({ shallow: false })
  );
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringLiteral(SORT_VALUES)
      .withDefault("relevance")
      .withOptions({ shallow: false })
  );
  const [isPinned, setIsPinned] = useQueryState(
    "pinned",
    parseAsBoolean.withOptions({ shallow: false })
  );
  const [isFavorite, setIsFavorite] = useQueryState(
    "favorite",
    parseAsBoolean.withOptions({ shallow: false })
  );
  const [sentiment, setSentiment] = useQueryState(
    "sentiment",
    parseAsString.withOptions({ shallow: false })
  );
  const [language, setLanguage] = useQueryState(
    "lang",
    parseAsString.withOptions({ shallow: false })
  );
  const [dateFrom, setDateFrom] = useQueryState(
    "from",
    parseAsInteger.withOptions({ shallow: false })
  );
  const [dateTo, setDateTo] = useQueryState(
    "to",
    parseAsInteger.withOptions({ shallow: false })
  );

  const typedConceptIds = (conceptIds ?? []) as Id<"concept">[];
  const typedTagIds = (tagIds ?? []) as Id<"tag">[];
  const typedCollectionId = collectionId as Id<"collection"> | null;

  const hasActiveFilters =
    (types?.length ?? 0) > 0 ||
    typedConceptIds.length > 0 ||
    typedTagIds.length > 0 ||
    collectionId !== null ||
    isPinned !== null ||
    isFavorite !== null ||
    !!sentiment ||
    !!language ||
    dateFrom !== null ||
    dateTo !== null;

  return {
    q,
    setQ,
    types,
    setTypes,
    conceptIds: typedConceptIds,
    setConceptIds,
    tagIds: typedTagIds,
    setTagIds,
    collectionId: typedCollectionId,
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
  };
}

export function clearAllFilters(handlers: {
  setTypes: (v: null) => void;
  setConceptIds: (v: null) => void;
  setTagIds: (v: null) => void;
  setCollectionId: (v: null) => void;
  setSort: (v: null) => void;
  setIsPinned: (v: null) => void;
  setIsFavorite: (v: null) => void;
  setSentiment: (v: null) => void;
  setLanguage: (v: null) => void;
  setDateFrom: (v: null) => void;
  setDateTo: (v: null) => void;
}) {
  handlers.setTypes(null);
  handlers.setConceptIds(null);
  handlers.setTagIds(null);
  handlers.setCollectionId(null);
  handlers.setSort(null);
  handlers.setIsPinned(null);
  handlers.setIsFavorite(null);
  handlers.setSentiment(null);
  handlers.setLanguage(null);
  handlers.setDateFrom(null);
  handlers.setDateTo(null);
}

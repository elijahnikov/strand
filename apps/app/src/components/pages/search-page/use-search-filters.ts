import type { Id } from "@omi/backend/_generated/dataModel.js";
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

export const EMBED_TYPE_VALUES = [
  "youtube",
  "tweet",
  "reddit",
  "spotify",
  "github_gist",
  "codepen",
  "vimeo",
  "loom",
  "figma",
  "codesandbox",
  "bluesky",
  "soundcloud",
  "google_docs",
  "google_sheets",
  "google_slides",
  "notion",
] as const;
export type SearchEmbedType = (typeof EMBED_TYPE_VALUES)[number];

export const SORT_VALUES = [
  "relevance",
  "newest",
  "oldest",
  "recently-updated",
  "alphabetical",
] as const;
export type SearchSort = (typeof SORT_VALUES)[number];

export const LIST_OPERATORS = ["is", "isNot"] as const;
export type ListOperator = (typeof LIST_OPERATORS)[number];

export const DATE_OPERATORS = ["before", "after", "between"] as const;
export type DateOperator = (typeof DATE_OPERATORS)[number];

/** Sentinel value stored in the URL's `collection` param to mean "resources with no collection". */
export const NO_COLLECTION_SENTINEL = "__none__";

const typeParser = parseAsArrayOf(parseAsStringLiteral(TYPE_VALUES));
const embedTypeParser = parseAsArrayOf(parseAsStringLiteral(EMBED_TYPE_VALUES));
const idParser = parseAsArrayOf(parseAsString);
const listOpParser = parseAsStringLiteral(LIST_OPERATORS);
const dateOpParser = parseAsStringLiteral(DATE_OPERATORS);

export function useSearchFilters() {
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [types, setTypes] = useQueryState(
    "type",
    typeParser.withOptions({ shallow: false })
  );
  const [typeOp, setTypeOp] = useQueryState(
    "typeOp",
    listOpParser.withOptions({ shallow: false })
  );
  const [embedTypes, setEmbedTypes] = useQueryState(
    "embed",
    embedTypeParser.withOptions({ shallow: false })
  );
  const [embedTypeOp, setEmbedTypeOp] = useQueryState(
    "embedOp",
    listOpParser.withOptions({ shallow: false })
  );
  const [conceptIds, setConceptIds] = useQueryState(
    "concepts",
    idParser.withOptions({ shallow: false })
  );
  const [conceptOp, setConceptOp] = useQueryState(
    "conceptOp",
    listOpParser.withOptions({ shallow: false })
  );
  const [tagIds, setTagIds] = useQueryState(
    "tags",
    idParser.withOptions({ shallow: false })
  );
  const [tagOp, setTagOp] = useQueryState(
    "tagOp",
    listOpParser.withOptions({ shallow: false })
  );
  const [createdByIds, setCreatedByIds] = useQueryState(
    "createdBy",
    idParser.withOptions({ shallow: false })
  );
  const [createdByOp, setCreatedByOp] = useQueryState(
    "createdByOp",
    listOpParser.withOptions({ shallow: false })
  );
  const [collectionId, setCollectionId] = useQueryState(
    "collection",
    parseAsString.withOptions({ shallow: false })
  );
  const [collectionOp, setCollectionOp] = useQueryState(
    "collectionOp",
    listOpParser.withOptions({ shallow: false })
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
  const [dateOp, setDateOp] = useQueryState(
    "dateOp",
    dateOpParser.withOptions({ shallow: false })
  );

  const typedConceptIds = (conceptIds ?? []) as Id<"concept">[];
  const typedTagIds = (tagIds ?? []) as Id<"tag">[];
  const typedCreatedByIds = (createdByIds ?? []) as Id<"user">[];
  // collectionId may be a real Id<"collection"> or the NO_COLLECTION_SENTINEL
  // string. Consumers must check for the sentinel before treating it as an Id.
  const typedCollectionId = collectionId;

  const hasActiveFilters =
    (types?.length ?? 0) > 0 ||
    (embedTypes?.length ?? 0) > 0 ||
    typedConceptIds.length > 0 ||
    typedTagIds.length > 0 ||
    typedCreatedByIds.length > 0 ||
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
    typeOp,
    setTypeOp,
    embedTypes,
    setEmbedTypes,
    embedTypeOp,
    setEmbedTypeOp,
    conceptIds: typedConceptIds,
    setConceptIds,
    conceptOp,
    setConceptOp,
    tagIds: typedTagIds,
    setTagIds,
    tagOp,
    setTagOp,
    createdByIds: typedCreatedByIds,
    setCreatedByIds,
    createdByOp,
    setCreatedByOp,
    collectionId: typedCollectionId,
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
  };
}

export function clearAllFilters(handlers: {
  setTypes: (v: null) => void;
  setTypeOp: (v: null) => void;
  setEmbedTypes: (v: null) => void;
  setEmbedTypeOp: (v: null) => void;
  setConceptIds: (v: null) => void;
  setConceptOp: (v: null) => void;
  setTagIds: (v: null) => void;
  setTagOp: (v: null) => void;
  setCreatedByIds: (v: null) => void;
  setCreatedByOp: (v: null) => void;
  setCollectionId: (v: null) => void;
  setCollectionOp: (v: null) => void;
  setSort: (v: null) => void;
  setIsPinned: (v: null) => void;
  setIsFavorite: (v: null) => void;
  setSentiment: (v: null) => void;
  setLanguage: (v: null) => void;
  setDateFrom: (v: null) => void;
  setDateTo: (v: null) => void;
  setDateOp: (v: null) => void;
}) {
  handlers.setTypes(null);
  handlers.setTypeOp(null);
  handlers.setEmbedTypes(null);
  handlers.setEmbedTypeOp(null);
  handlers.setConceptIds(null);
  handlers.setConceptOp(null);
  handlers.setTagIds(null);
  handlers.setTagOp(null);
  handlers.setCreatedByIds(null);
  handlers.setCreatedByOp(null);
  handlers.setCollectionId(null);
  handlers.setCollectionOp(null);
  handlers.setSort(null);
  handlers.setIsPinned(null);
  handlers.setIsFavorite(null);
  handlers.setSentiment(null);
  handlers.setLanguage(null);
  handlers.setDateFrom(null);
  handlers.setDateTo(null);
  handlers.setDateOp(null);
}

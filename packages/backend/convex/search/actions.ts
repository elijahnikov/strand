"use node";

import { generateEmbedding } from "@omi/ai/embeddings";
import { createOpenAIProvider } from "@omi/ai/providers";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { rateLimiter } from "../rateLimiter";
import { getAuthIdentity } from "../utils";
import { buildSnippet, extractQueryTokens, highlight } from "./highlight";
import { extractBoostTerms, matchesBoostTerms } from "./memoryBoost";

const RRF_K = 60;
const SIGNAL_WEIGHTS = {
  title: 1.3,
  semantic: 1.0,
  chunk: 1.2,
  concept: 0.8,
  tag: 0.5,
} as const;

const CONCEPT_MATCH_THRESHOLD = 0.5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SIGNAL_FANOUT = 50;
const CONCEPT_FANOUT = 10;
const MAX_QUERY_LENGTH = 400;
const BOOST_MAX_MULTIPLIER = 1.3;
const BOOST_PER_IMPORTANCE = 0.15;

type MatchReason =
  | { type: "title" }
  | { type: "semantic"; score: number }
  | {
      type: "chunk";
      chunkIndex: number;
      content: string;
      page?: number;
      score: number;
    }
  | {
      type: "concept";
      conceptId: Id<"concept">;
      conceptName: string;
      importance: number;
    }
  | { type: "tag"; tagId: Id<"tag">; tagName: string }
  | { type: "personalized"; conceptName: string };

interface EnrichedResource {
  _creationTime: number;
  _id: Id<"resource">;
  aiStatus?: "pending" | "processing" | "completed" | "failed";
  category?: string;
  collectionId?: Id<"collection">;
  concepts: Array<{ _id: Id<"concept">; name: string; importance: number }>;
  createdBy: Id<"user">;
  deletedAt?: number;
  description?: string;
  file?: {
    fileName?: string;
    mimeType?: string;
    extractedText?: string;
    storageId?: Id<"_storage">;
  } | null;
  fileUrl?: string | null;
  isArchived: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  language?: string;
  note?: { plainTextContent?: string } | null;
  sentiment?: string;
  summary?: string;
  tags: Array<{ _id: Id<"tag">; name: string; color?: string }>;
  title: string;
  type: "website" | "note" | "file";
  updatedAt: number;
  website?: {
    url?: string;
    domain?: string;
    favicon?: string;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
    articleContent?: string;
    metadataStatus?: "pending" | "processing" | "completed" | "failed";
    embedType?: string;
  } | null;
  workspaceId: Id<"workspace">;
}

export interface SearchResult {
  aiStatus?: "pending" | "processing" | "completed" | "failed";
  bestSnippet: string | null;
  matchReasons: MatchReason[];
  resource: EnrichedResource;
  resourceId: Id<"resource">;
  score: number;
  sharedConcepts: string[];
  titleHtml: string;
}

export interface HybridSearchResponse {
  embeddingReady: boolean;
  results: SearchResult[];
  stats: {
    titleHits: number;
    semanticHits: number;
    chunkHits: number;
    conceptHits: number;
    tagHits: number;
    totalCandidates: number;
  };
  usedFallback: boolean;
}

type ListOp = "is" | "isNot";
type DateOp = "before" | "after" | "between";

interface FiltersArg {
  collectionId?: Id<"collection"> | null;
  collectionIdOp?: ListOp;
  conceptIds?: Id<"concept">[];
  conceptIdsOp?: ListOp;
  createdBy?: Id<"user">[];
  createdByOp?: ListOp;
  dateFrom?: number;
  dateOp?: DateOp;
  dateTo?: number;
  embedTypes?: string[];
  embedTypesOp?: ListOp;
  hasAI?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  isPinned?: boolean;
  language?: string;
  sentiment?: string;
  tagIds?: Id<"tag">[];
  tagIdsOp?: ListOp;
  types?: Array<"website" | "note" | "file">;
  typesOp?: ListOp;
}

const listOpValidator = v.union(v.literal("is"), v.literal("isNot"));
const dateOpValidator = v.union(
  v.literal("before"),
  v.literal("after"),
  v.literal("between")
);

const filtersValidator = v.object({
  types: v.optional(
    v.array(v.union(v.literal("website"), v.literal("note"), v.literal("file")))
  ),
  typesOp: v.optional(listOpValidator),
  embedTypes: v.optional(v.array(v.string())),
  embedTypesOp: v.optional(listOpValidator),
  conceptIds: v.optional(v.array(v.id("concept"))),
  conceptIdsOp: v.optional(listOpValidator),
  tagIds: v.optional(v.array(v.id("tag"))),
  tagIdsOp: v.optional(listOpValidator),
  createdBy: v.optional(v.array(v.id("user"))),
  createdByOp: v.optional(listOpValidator),
  collectionId: v.optional(v.union(v.id("collection"), v.null())),
  collectionIdOp: v.optional(listOpValidator),
  isPinned: v.optional(v.boolean()),
  isFavorite: v.optional(v.boolean()),
  isArchived: v.optional(v.boolean()),
  hasAI: v.optional(v.boolean()),
  sentiment: v.optional(v.string()),
  language: v.optional(v.string()),
  dateFrom: v.optional(v.number()),
  dateTo: v.optional(v.number()),
  dateOp: v.optional(dateOpValidator),
});

const sortValidator = v.union(
  v.literal("relevance"),
  v.literal("newest"),
  v.literal("oldest"),
  v.literal("recently-updated"),
  v.literal("alphabetical")
);

export const hybridSearch = action({
  args: {
    workspaceId: v.id("workspace"),
    query: v.string(),
    filters: v.optional(filtersValidator),
    sort: v.optional(sortValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<HybridSearchResponse> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.runQuery(
      internal.search.internals.validateMembership,
      {
        workspaceId: args.workspaceId,
        userId: identity.userId as Id<"user">,
      }
    );
    if (!membership) {
      throw new Error("Not authorized");
    }

    await rateLimiter.limit(ctx, "hybridSearch", {
      key: identity.userId,
      throws: true,
    });

    const filters: FiltersArg = args.filters ?? {};
    const sort = args.sort ?? "relevance";
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const rawQuery = args.query.slice(0, MAX_QUERY_LENGTH).trim();
    const queryTokens = extractQueryTokens(rawQuery);

    const hasFreeText = rawQuery.length > 0;
    const hasAnyFilter =
      (filters.conceptIds?.length ?? 0) > 0 ||
      (filters.tagIds?.length ?? 0) > 0 ||
      (filters.types?.length ?? 0) > 0 ||
      (filters.embedTypes?.length ?? 0) > 0 ||
      (filters.createdBy?.length ?? 0) > 0 ||
      filters.collectionId !== undefined ||
      filters.isPinned !== undefined ||
      filters.isFavorite !== undefined ||
      filters.isArchived !== undefined ||
      filters.hasAI !== undefined ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      Boolean(filters.sentiment) ||
      Boolean(filters.language);

    if (!(hasFreeText || hasAnyFilter)) {
      return {
        results: [],
        stats: {
          titleHits: 0,
          semanticHits: 0,
          chunkHits: 0,
          conceptHits: 0,
          tagHits: 0,
          totalCandidates: 0,
        },
        embeddingReady: false,
        usedFallback: true,
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    const embeddingReady = (await ctx.runQuery(
      internal.search.internals.hasEmbeddings,
      { workspaceId: args.workspaceId }
    )) as boolean;

    const canSemantic = Boolean(apiKey) && embeddingReady && hasFreeText;
    const usedFallback = !canSemantic;

    const titleRanks = new Map<Id<"resource">, number>();
    const semanticRanks = new Map<Id<"resource">, number>();
    const chunkRanks = new Map<Id<"resource">, number>();
    const conceptRanks = new Map<Id<"resource">, number>();
    const tagRanks = new Map<Id<"resource">, number>();

    const semanticScores = new Map<Id<"resource">, number>();
    const chunkHitByResource = new Map<
      Id<"resource">,
      {
        chunkIndex: number;
        content: string;
        page?: number;
        score: number;
      }
    >();
    const conceptHitsByResource = new Map<
      Id<"resource">,
      Array<{
        conceptId: Id<"concept">;
        conceptName: string;
        importance: number;
      }>
    >();
    const tagHitsByResource = new Map<
      Id<"resource">,
      Array<{ tagId: Id<"tag">; tagName: string }>
    >();

    const titleHitsPromise = hasFreeText
      ? ctx.runQuery(internal.search.internals.titleSearch, {
          workspaceId: args.workspaceId,
          query: rawQuery,
          limit: SIGNAL_FANOUT,
        })
      : Promise.resolve(
          [] as Array<{ resourceId: Id<"resource">; rank: number }>
        );

    const tagHitsPromise = hasFreeText
      ? ctx.runQuery(internal.search.internals.tagSearch, {
          workspaceId: args.workspaceId,
          query: rawQuery,
          limit: SIGNAL_FANOUT,
        })
      : Promise.resolve(
          [] as Array<{
            resourceId: Id<"resource">;
            tagId: Id<"tag">;
            tagName: string;
            rank: number;
          }>
        );

    let queryEmbedding: number[] | null = null;
    if (canSemantic) {
      const provider = createOpenAIProvider(apiKey as string);
      try {
        const { embedding } = await generateEmbedding(provider, rawQuery);
        queryEmbedding = embedding;
      } catch {
        queryEmbedding = null;
      }
    }

    const semanticHitsPromise =
      canSemantic && queryEmbedding
        ? ctx.vectorSearch("resourceEmbedding", "by_embedding", {
            vector: queryEmbedding,
            limit: SIGNAL_FANOUT,
            filter: (q) => q.eq("workspaceId", args.workspaceId),
          })
        : Promise.resolve(
            [] as Array<{ _id: Id<"resourceEmbedding">; _score: number }>
          );

    const chunkHitsPromise =
      canSemantic && queryEmbedding
        ? ctx.vectorSearch("resourceChunk", "by_embedding", {
            vector: queryEmbedding,
            limit: SIGNAL_FANOUT * 2,
            filter: (q) => q.eq("workspaceId", args.workspaceId),
          })
        : Promise.resolve(
            [] as Array<{ _id: Id<"resourceChunk">; _score: number }>
          );

    const conceptVectorHitsPromise =
      canSemantic && queryEmbedding
        ? ctx.vectorSearch("concept", "by_embedding", {
            vector: queryEmbedding,
            limit: CONCEPT_FANOUT,
            filter: (q) => q.eq("workspaceId", args.workspaceId),
          })
        : Promise.resolve([] as Array<{ _id: Id<"concept">; _score: number }>);

    const [titleHits, tagHits, semanticHits, chunkHits, conceptVectorHits] =
      await Promise.all([
        titleHitsPromise,
        tagHitsPromise,
        semanticHitsPromise,
        chunkHitsPromise,
        conceptVectorHitsPromise,
      ]);

    for (const hit of titleHits) {
      if (!titleRanks.has(hit.resourceId)) {
        titleRanks.set(hit.resourceId, hit.rank);
      }
    }

    for (const hit of tagHits) {
      if (!tagRanks.has(hit.resourceId)) {
        tagRanks.set(hit.resourceId, hit.rank);
      }
      const list = tagHitsByResource.get(hit.resourceId) ?? [];
      if (!list.some((t) => t.tagId === hit.tagId)) {
        list.push({ tagId: hit.tagId, tagName: hit.tagName });
      }
      tagHitsByResource.set(hit.resourceId, list);
    }

    const [semanticResourceIds, chunkDocs] = await Promise.all([
      semanticHits.length > 0
        ? ctx.runQuery(internal.search.internals.getResourceIdsForEmbeddings, {
            embeddingIds: semanticHits.map((h) => h._id),
          })
        : Promise.resolve([] as Array<Id<"resource"> | null>),
      chunkHits.length > 0
        ? ctx.runQuery(internal.search.internals.getChunksByIds, {
            chunkIds: chunkHits.map((h) => h._id),
          })
        : Promise.resolve(
            [] as Array<{
              resourceId: Id<"resource">;
              chunkIndex: number;
              content: string;
              metadata?: { pageNumber?: number };
            } | null>
          ),
    ]);

    let semanticRank = 0;
    for (let i = 0; i < semanticHits.length; i++) {
      const hit = semanticHits[i];
      const resourceId = semanticResourceIds[i];
      if (!(hit && resourceId)) {
        continue;
      }
      if (!semanticRanks.has(resourceId)) {
        semanticRanks.set(resourceId, semanticRank);
        semanticScores.set(resourceId, hit._score);
        semanticRank += 1;
      }
    }

    let chunkRank = 0;
    for (let i = 0; i < chunkHits.length; i++) {
      const hit = chunkHits[i];
      const chunk = chunkDocs[i];
      if (!(hit && chunk)) {
        continue;
      }
      const resourceId = chunk.resourceId as Id<"resource">;
      if (chunkHitByResource.has(resourceId)) {
        continue;
      }
      chunkRanks.set(resourceId, chunkRank);
      chunkHitByResource.set(resourceId, {
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        page: chunk.metadata?.pageNumber,
        score: hit._score,
      });
      chunkRank += 1;
    }

    const matchedConceptIds: Id<"concept">[] = [];
    for (const hit of conceptVectorHits) {
      if (hit._score >= CONCEPT_MATCH_THRESHOLD) {
        matchedConceptIds.push(hit._id);
      }
    }

    if (matchedConceptIds.length > 0) {
      const conceptHits = await ctx.runQuery(
        internal.search.internals.listResourcesForConcepts,
        { conceptIds: matchedConceptIds }
      );
      let rankCursor = 0;
      const seenForRank = new Set<Id<"resource">>();
      for (const hit of conceptHits) {
        const list = conceptHitsByResource.get(hit.resourceId) ?? [];
        if (!list.some((c) => c.conceptId === hit.conceptId)) {
          list.push({
            conceptId: hit.conceptId,
            conceptName: hit.conceptName,
            importance: hit.importance,
          });
        }
        conceptHitsByResource.set(hit.resourceId, list);
        if (!seenForRank.has(hit.resourceId)) {
          seenForRank.add(hit.resourceId);
          conceptRanks.set(hit.resourceId, rankCursor);
          rankCursor += 1;
        }
      }
    }

    const candidates = new Set<Id<"resource">>();
    for (const id of titleRanks.keys()) {
      candidates.add(id);
    }
    for (const id of semanticRanks.keys()) {
      candidates.add(id);
    }
    for (const id of chunkRanks.keys()) {
      candidates.add(id);
    }
    for (const id of conceptRanks.keys()) {
      candidates.add(id);
    }
    for (const id of tagRanks.keys()) {
      candidates.add(id);
    }

    if ((filters.conceptIds?.length ?? 0) > 0) {
      const extra = await ctx.runQuery(
        internal.search.internals.listResourcesForConcepts,
        { conceptIds: filters.conceptIds ?? [] }
      );
      const matched = new Set<Id<"resource">>();
      for (const hit of extra) {
        matched.add(hit.resourceId);
      }
      const conceptOp: ListOp = filters.conceptIdsOp ?? "is";
      if (conceptOp === "isNot") {
        for (const id of matched) {
          candidates.delete(id);
        }
      } else if (candidates.size === 0 && !hasFreeText) {
        for (const id of matched) {
          candidates.add(id);
        }
      } else {
        for (const id of Array.from(candidates)) {
          if (!matched.has(id)) {
            candidates.delete(id);
          }
        }
      }
    }

    const hasOtherFilter =
      (filters.types?.length ?? 0) > 0 ||
      (filters.createdBy?.length ?? 0) > 0 ||
      filters.collectionId !== undefined ||
      filters.isPinned !== undefined ||
      filters.isFavorite !== undefined ||
      filters.isArchived !== undefined ||
      filters.hasAI !== undefined ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      Boolean(filters.sentiment) ||
      Boolean(filters.language);
    const hasConceptOrTagFilter =
      (filters.conceptIds?.length ?? 0) > 0 ||
      (filters.tagIds?.length ?? 0) > 0;

    if (
      !hasFreeText &&
      hasOtherFilter &&
      !hasConceptOrTagFilter &&
      candidates.size === 0
    ) {
      const filteredIds = (await ctx.runQuery(
        internal.search.internals.listFilteredResourceIds,
        {
          workspaceId: args.workspaceId,
          types: filters.types,
          typesOp: filters.typesOp,
          createdBy: filters.createdBy,
          createdByOp: filters.createdByOp,
          collectionId: filters.collectionId,
          collectionIdOp: filters.collectionIdOp,
          isPinned: filters.isPinned,
          isFavorite: filters.isFavorite,
          isArchived: filters.isArchived,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          dateOp: filters.dateOp,
          limit: Math.max(limit * 2, MAX_LIMIT),
        }
      )) as Id<"resource">[];
      for (const id of filteredIds) {
        candidates.add(id);
      }
    }

    if ((filters.tagIds?.length ?? 0) > 0) {
      const tagSets = (await ctx.runQuery(
        internal.search.internals.listResourcesForTags,
        {
          workspaceId: args.workspaceId,
          tagIds: filters.tagIds ?? [],
        }
      )) as Set<Id<"resource">>[];
      const tagOp: ListOp = filters.tagIdsOp ?? "is";
      if (tagOp === "isNot") {
        const union = new Set<Id<"resource">>();
        for (const set of tagSets) {
          for (const id of set) {
            union.add(id);
          }
        }
        for (const id of union) {
          candidates.delete(id);
        }
      } else {
        const intersection = new Set<Id<"resource">>();
        if (tagSets.length > 0) {
          const [first, ...rest] = tagSets;
          if (first) {
            for (const id of first) {
              if (rest.every((s) => s.has(id))) {
                intersection.add(id);
              }
            }
          }
        }
        if (candidates.size === 0 && !hasFreeText) {
          for (const id of intersection) {
            candidates.add(id);
          }
        } else {
          for (const id of Array.from(candidates)) {
            if (!intersection.has(id)) {
              candidates.delete(id);
            }
          }
        }
      }
    }

    const candidateIds = Array.from(candidates);
    const enriched = (await ctx.runQuery(
      internal.search.internals.enrichResources,
      { resourceIds: candidateIds }
    )) as EnrichedResource[];

    const memoryContent = (await ctx.runQuery(
      internal.search.internals.getUserMemoryContent,
      {
        workspaceId: args.workspaceId,
        userId: identity.userId as Id<"user">,
      }
    )) as string | null;
    const boostTerms = extractBoostTerms(memoryContent);

    const scored: Array<{
      resource: EnrichedResource;
      score: number;
      matchReasons: MatchReason[];
    }> = [];

    for (const resource of enriched) {
      const id = resource._id as Id<"resource">;

      if (!passesFilters(resource, filters)) {
        continue;
      }

      const matchReasons: MatchReason[] = [];
      let score = 0;

      const tRank = titleRanks.get(id);
      if (tRank !== undefined) {
        score += SIGNAL_WEIGHTS.title * (1 / (RRF_K + tRank + 1));
        matchReasons.push({ type: "title" });
      }

      const sRank = semanticRanks.get(id);
      if (sRank !== undefined) {
        score += SIGNAL_WEIGHTS.semantic * (1 / (RRF_K + sRank + 1));
        const semScore = semanticScores.get(id);
        if (semScore !== undefined) {
          matchReasons.push({ type: "semantic", score: semScore });
        }
      }

      const cRank = chunkRanks.get(id);
      if (cRank !== undefined) {
        score += SIGNAL_WEIGHTS.chunk * (1 / (RRF_K + cRank + 1));
        const chunk = chunkHitByResource.get(id);
        if (chunk) {
          matchReasons.push({
            type: "chunk",
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            page: chunk.page,
            score: chunk.score,
          });
        }
      }

      const conRank = conceptRanks.get(id);
      if (conRank !== undefined) {
        score += SIGNAL_WEIGHTS.concept * (1 / (RRF_K + conRank + 1));
        const hits = conceptHitsByResource.get(id) ?? [];
        for (const hit of hits) {
          matchReasons.push({
            type: "concept",
            conceptId: hit.conceptId,
            conceptName: hit.conceptName,
            importance: hit.importance,
          });
        }
      }

      const tagRank = tagRanks.get(id);
      if (tagRank !== undefined) {
        score += SIGNAL_WEIGHTS.tag * (1 / (RRF_K + tagRank + 1));
        const hits = tagHitsByResource.get(id) ?? [];
        for (const hit of hits) {
          matchReasons.push({
            type: "tag",
            tagId: hit.tagId,
            tagName: hit.tagName,
          });
        }
      }

      if (score === 0 && hasFreeText) {
        continue;
      }

      if (boostTerms.length > 0 && resource.concepts) {
        let multiplier = 1;
        const alreadyBoosted = new Set<string>();
        for (const concept of resource.concepts) {
          if (!matchesBoostTerms(concept.name, boostTerms)) {
            continue;
          }
          if (alreadyBoosted.has(concept.name)) {
            continue;
          }
          alreadyBoosted.add(concept.name);
          multiplier = Math.min(
            BOOST_MAX_MULTIPLIER,
            multiplier + BOOST_PER_IMPORTANCE * concept.importance
          );
          matchReasons.push({
            type: "personalized",
            conceptName: concept.name,
          });
        }
        score *= multiplier;
      }

      scored.push({ resource, score, matchReasons });
    }

    let sorted: typeof scored;
    switch (sort) {
      case "newest":
        sorted = [...scored].sort(
          (a, b) => b.resource._creationTime - a.resource._creationTime
        );
        break;
      case "oldest":
        sorted = [...scored].sort(
          (a, b) => a.resource._creationTime - b.resource._creationTime
        );
        break;
      case "recently-updated":
        sorted = [...scored].sort(
          (a, b) => (b.resource.updatedAt ?? 0) - (a.resource.updatedAt ?? 0)
        );
        break;
      case "alphabetical":
        sorted = [...scored].sort((a, b) =>
          a.resource.title.localeCompare(b.resource.title)
        );
        break;
      default:
        sorted = [...scored].sort((a, b) => b.score - a.score);
    }

    const top = sorted.slice(0, limit);

    const results: SearchResult[] = top.map((entry) => {
      const sharedConcepts = Array.from(
        new Set(
          entry.matchReasons
            .filter(
              (r): r is Extract<MatchReason, { type: "concept" }> =>
                r.type === "concept"
            )
            .map((r) => r.conceptName)
        )
      );

      const bestSnippet = computeBestSnippet(
        entry.resource,
        queryTokens,
        entry.matchReasons
      );

      const titleHtml = highlight(entry.resource.title, queryTokens);

      return {
        resourceId: entry.resource._id,
        resource: entry.resource,
        titleHtml,
        score: entry.score,
        matchReasons: entry.matchReasons,
        bestSnippet,
        sharedConcepts,
        aiStatus: entry.resource.aiStatus,
      };
    });

    return {
      results,
      stats: {
        titleHits: titleRanks.size,
        semanticHits: semanticRanks.size,
        chunkHits: chunkRanks.size,
        conceptHits: conceptRanks.size,
        tagHits: tagRanks.size,
        totalCandidates: candidates.size,
      },
      embeddingReady,
      usedFallback,
    };
  },
});

function passesFilters(
  resource: EnrichedResource,
  filters: FiltersArg
): boolean {
  if (resource.deletedAt) {
    return false;
  }
  if (filters.types && filters.types.length > 0) {
    const typeOp: ListOp = filters.typesOp ?? "is";
    const matches = filters.types.includes(resource.type);
    if (typeOp === "is" && !matches) {
      return false;
    }
    if (typeOp === "isNot" && matches) {
      return false;
    }
  }
  if (filters.embedTypes && filters.embedTypes.length > 0) {
    const embedTypeOp: ListOp = filters.embedTypesOp ?? "is";
    const embedType = resource.website?.embedType;
    const matches = embedType ? filters.embedTypes.includes(embedType) : false;
    if (embedTypeOp === "is" && !matches) {
      return false;
    }
    if (embedTypeOp === "isNot" && matches) {
      return false;
    }
  }
  if (filters.createdBy && filters.createdBy.length > 0) {
    const createdByOp: ListOp = filters.createdByOp ?? "is";
    const matches = filters.createdBy.includes(resource.createdBy);
    if (createdByOp === "is" && !matches) {
      return false;
    }
    if (createdByOp === "isNot" && matches) {
      return false;
    }
  }
  if (
    filters.isPinned !== undefined &&
    resource.isPinned !== filters.isPinned
  ) {
    return false;
  }
  if (
    filters.isFavorite !== undefined &&
    resource.isFavorite !== filters.isFavorite
  ) {
    return false;
  }
  if (filters.isArchived !== undefined) {
    if (resource.isArchived !== filters.isArchived) {
      return false;
    }
  } else if (resource.isArchived) {
    return false;
  }
  if (filters.collectionId !== undefined) {
    const collectionOp: ListOp = filters.collectionIdOp ?? "is";
    const matches =
      filters.collectionId === null
        ? !resource.collectionId
        : resource.collectionId === filters.collectionId;
    if (collectionOp === "is" && !matches) {
      return false;
    }
    if (collectionOp === "isNot" && matches) {
      return false;
    }
  }
  const dateOp: DateOp = filters.dateOp ?? "between";
  if (
    (dateOp === "after" || dateOp === "between") &&
    filters.dateFrom !== undefined &&
    resource._creationTime < filters.dateFrom
  ) {
    return false;
  }
  if (
    (dateOp === "before" || dateOp === "between") &&
    filters.dateTo !== undefined &&
    resource._creationTime > filters.dateTo
  ) {
    return false;
  }
  if (filters.hasAI !== undefined) {
    const aiCompleted = resource.aiStatus === "completed";
    if (filters.hasAI !== aiCompleted) {
      return false;
    }
  }
  if (filters.sentiment && resource.sentiment !== filters.sentiment) {
    return false;
  }
  if (filters.language && resource.language !== filters.language) {
    return false;
  }
  return true;
}

function computeBestSnippet(
  resource: EnrichedResource,
  tokens: string[],
  matchReasons: MatchReason[]
): string | null {
  const chunkReason = matchReasons.find(
    (r): r is Extract<MatchReason, { type: "chunk" }> => r.type === "chunk"
  );
  if (chunkReason) {
    return buildSnippet(chunkReason.content, tokens);
  }

  switch (resource.type) {
    case "website": {
      const article = resource.website?.articleContent;
      if (article) {
        return buildSnippet(article, tokens);
      }
      const og = resource.website?.ogDescription;
      if (og) {
        return buildSnippet(og, tokens);
      }
      break;
    }
    case "note": {
      const plain = resource.note?.plainTextContent;
      if (plain) {
        return buildSnippet(plain, tokens);
      }
      break;
    }
    case "file": {
      const extracted = resource.file?.extractedText;
      if (extracted) {
        return buildSnippet(extracted, tokens);
      }
      break;
    }
    default:
      break;
  }

  if (resource.summary) {
    return buildSnippet(resource.summary, tokens);
  }
  if (resource.description) {
    return buildSnippet(resource.description, tokens);
  }
  return null;
}

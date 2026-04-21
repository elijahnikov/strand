import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHarness,
  seedResource,
  seedUser,
  seedWorkspace,
} from "../../test/harness";
import {
  defaultEnrichmentResult,
  fakeEmbedding,
  mockEmbeddingsModule,
  mockEnrichmentModule,
  mockProvidersModule,
} from "../../test/mockAi";
import { internal } from "../_generated/api";

// Mock the AI package so `processResourceAI` never calls OpenAI.
// Factories must be self-contained (vi.mock hoists and can't close over module
// scope), so each factory re-declares what it needs.
vi.mock("@omi/ai/providers", async () => {
  const { mockProvidersModule: m } = await import("../../test/mockAi");
  return m();
});
vi.mock("@omi/ai/embeddings", async () => {
  const { mockEmbeddingsModule: m } = await import("../../test/mockAi");
  return m();
});
vi.mock("@omi/ai/enrichment", async () => {
  const { mockEnrichmentModule: m, defaultEnrichmentResult: d } = await import(
    "../../test/mockAi"
  );
  return m(d());
});

// Silence unused-import warnings for the helper imports — the vi.mock factories
// above close over these via dynamic import, but the static import keeps
// editors honest about types and gives a stable symbol if factories are
// refactored.
void mockProvidersModule;
void mockEmbeddingsModule;
void mockEnrichmentModule;
void defaultEnrichmentResult;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
});

const openApiKeyRegex = /OPENAI_API_KEY/;

describe("processResourceAI", () => {
  it("marks status=failed when OPENAI_API_KEY is missing", async () => {
    // Assigning `undefined` coerces to the string "undefined" (truthy), which
    // would let the action proceed past the key check. Use empty string —
    // falsy in the `if (!apiKey)` guard — to simulate a missing key without
    // calling `delete` on process.env (some lint configs flag that).
    process.env.OPENAI_API_KEY = "";
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId);

    await t.action(internal.resource.aiActions.processResourceAI, {
      resourceId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("failed");
    expect(row?.error).toMatch(openApiKeyRegex);
  });

  it("short notes short-circuit to completed without enrichment", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId, {
      type: "note",
    });
    // Seed the note row with content below MIN_CONTENT_LENGTH (50 chars).
    await t.run(async (ctx) =>
      ctx.db.insert("noteResource", {
        resourceId,
        plainTextContent: "too short",
      })
    );

    await t.action(internal.resource.aiActions.processResourceAI, {
      resourceId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("completed");
    // Enrichment fields are not populated for short-circuited notes.
    expect(row?.summary).toBeUndefined();
  });

  it("happy path: note content → enrichment + embedding stored, status=completed", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId, {
      type: "note",
      title: "My research note",
    });
    const longText = "This is a substantive note about a topic ".repeat(10);
    await t.run(async (ctx) =>
      ctx.db.insert("noteResource", {
        resourceId,
        plainTextContent: longText,
      })
    );

    await t.action(internal.resource.aiActions.processResourceAI, {
      resourceId,
    });
    // Flush any scheduled followups (generateResourceLinks is scheduled at 0).
    await t.finishInProgressScheduledFunctions();

    const row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("completed");
    expect(row?.summary).toBe("A mock summary.");
    expect(row?.tags).toContain("mock-tag");

    const embedding = await t.run(async (ctx) =>
      ctx.db
        .query("resourceEmbedding")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .unique()
    );
    expect(embedding).not.toBeNull();
    expect(embedding?.embedding).toHaveLength(1536);
  });
});

describe("generateResourceLinks", () => {
  it("creates a link between two resources with overlapping concepts + similar embeddings", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);

    const { resourceId: sourceId } = await seedResource(
      t,
      workspaceId,
      userId,
      {
        title: "Source",
      }
    );
    const { resourceId: targetId } = await seedResource(
      t,
      workspaceId,
      userId,
      {
        title: "Target",
      }
    );

    // Seed identical embeddings so cosine similarity is ~1.0 (max semantic).
    const sharedEmbedding = fakeEmbedding("shared topic");
    await t.run(async (ctx) => {
      await ctx.db.insert("resourceEmbedding", {
        resourceId: sourceId,
        workspaceId,
        embedding: sharedEmbedding,
        model: "text-embedding-3-small",
        inputHash: "source-hash",
      });
      await ctx.db.insert("resourceEmbedding", {
        resourceId: targetId,
        workspaceId,
        embedding: sharedEmbedding,
        model: "text-embedding-3-small",
        inputHash: "target-hash",
      });

      // Seed a shared concept so the weighted Jaccard overlap > 0.
      const conceptEmbedding = fakeEmbedding("shared concept");
      const conceptId = await ctx.db.insert("concept", {
        workspaceId,
        name: "Shared Topic",
        embedding: conceptEmbedding,
      });
      await ctx.db.insert("resourceConcept", {
        resourceId: sourceId,
        conceptId,
        workspaceId,
        importance: 0.8,
      });
      await ctx.db.insert("resourceConcept", {
        resourceId: targetId,
        conceptId,
        workspaceId,
        importance: 0.9,
      });
    });

    await t.action(internal.resource.aiActions.generateResourceLinks, {
      resourceId: sourceId,
      workspaceId,
    });

    const links = await t.run(async (ctx) =>
      ctx.db
        .query("resourceLink")
        .withIndex("by_source", (q) => q.eq("sourceResourceId", sourceId))
        .collect()
    );
    expect(links).toHaveLength(1);
    const link = links[0];
    expect(link?.targetResourceId).toBe(targetId);
    expect(link?.status).toBe("auto");
    expect(link?.sharedConcepts).toContain("shared topic");
    expect(link?.conceptOverlap).toBeGreaterThan(0);
    expect(link?.score).toBeGreaterThanOrEqual(0.35);
  });

  it("does not link two resources with no concept overlap and low semantic similarity", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);

    const { resourceId: sourceId } = await seedResource(t, workspaceId, userId);
    const { resourceId: targetId } = await seedResource(t, workspaceId, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("resourceEmbedding", {
        resourceId: sourceId,
        workspaceId,
        embedding: fakeEmbedding("alpha"),
        model: "text-embedding-3-small",
        inputHash: "alpha-hash",
      });
      await ctx.db.insert("resourceEmbedding", {
        resourceId: targetId,
        workspaceId,
        embedding: fakeEmbedding("zeta"),
        model: "text-embedding-3-small",
        inputHash: "zeta-hash",
      });
    });

    await t.action(internal.resource.aiActions.generateResourceLinks, {
      resourceId: sourceId,
      workspaceId,
    });

    // Deterministic fake embeddings for unrelated strings produce low cosine
    // similarity that falls below SEMANTIC_ONLY_THRESHOLD (0.4).
    const links = await t.run(async (ctx) =>
      ctx.db
        .query("resourceLink")
        .withIndex("by_source", (q) => q.eq("sourceResourceId", sourceId))
        .collect()
    );
    expect(links).toHaveLength(0);
  });
});

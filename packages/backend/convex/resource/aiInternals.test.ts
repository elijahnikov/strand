import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import {
  createHarness,
  seedResource,
  seedUser,
  seedWorkspace,
} from "../_test/harness";
import { fakeEmbedding } from "../_test/mockAi";

// Exercises the DB layer for the RAG pipeline without any OpenAI calls.
// These mutations back the highest-traffic write paths (embeddings + chunks
// + status transitions), so idempotency bugs here cause duplicate rows and
// silent drift in production search results.

describe("upsertResourceEmbedding", () => {
  it("inserts a new embedding row when none exists", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId } = await seedResource(t, workspaceId, userId);
    const embedding = fakeEmbedding("hello world");

    await t.mutation(internal.resource.aiInternals.upsertResourceEmbedding, {
      resourceId,
      workspaceId,
      embedding,
      model: "text-embedding-3-small",
      inputHash: "hash-v1",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("resourceEmbedding")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.inputHash).toBe("hash-v1");
    expect(rows[0]?.embedding).toHaveLength(1536);
  });

  it("is a no-op when inputHash matches (dedup by hash)", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId } = await seedResource(t, workspaceId, userId);
    const embedding = fakeEmbedding("hello world");

    await t.mutation(internal.resource.aiInternals.upsertResourceEmbedding, {
      resourceId,
      workspaceId,
      embedding,
      model: "text-embedding-3-small",
      inputHash: "hash-v1",
    });

    // Second call with same hash but a different embedding — should be skipped.
    const otherEmbedding = fakeEmbedding("completely different text");
    await t.mutation(internal.resource.aiInternals.upsertResourceEmbedding, {
      resourceId,
      workspaceId,
      embedding: otherEmbedding,
      model: "text-embedding-3-small",
      inputHash: "hash-v1",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("resourceEmbedding")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .collect()
    );
    expect(rows).toHaveLength(1);
    // The original embedding is preserved because the hash matched.
    expect(rows[0]?.embedding[0]).toBe(embedding[0]);
  });

  it("updates in place when inputHash changes (no duplicate row)", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId } = await seedResource(t, workspaceId, userId);

    await t.mutation(internal.resource.aiInternals.upsertResourceEmbedding, {
      resourceId,
      workspaceId,
      embedding: fakeEmbedding("v1"),
      model: "text-embedding-3-small",
      inputHash: "hash-v1",
    });

    const newEmbedding = fakeEmbedding("v2");
    await t.mutation(internal.resource.aiInternals.upsertResourceEmbedding, {
      resourceId,
      workspaceId,
      embedding: newEmbedding,
      model: "text-embedding-3-small",
      inputHash: "hash-v2",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("resourceEmbedding")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.inputHash).toBe("hash-v2");
    expect(rows[0]?.embedding[0]).toBe(newEmbedding[0]);
  });
});

describe("insertResourceChunks", () => {
  it("inserts all chunks passed in a single call", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId } = await seedResource(t, workspaceId, userId);

    const chunks = [0, 1, 2].map((chunkIndex) => ({
      resourceId,
      workspaceId,
      chunkIndex,
      content: `chunk ${chunkIndex}`,
      embedding: fakeEmbedding(`chunk ${chunkIndex}`),
      model: "text-embedding-3-small",
      startOffset: chunkIndex * 100,
      endOffset: (chunkIndex + 1) * 100,
      contentHash: "hash-v1",
    }));

    await t.mutation(internal.resource.aiInternals.insertResourceChunks, {
      chunks,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("resourceChunk")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
        .collect()
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.chunkIndex).sort()).toEqual([0, 1, 2]);
  });
});

describe("deleteResourceChunks", () => {
  it("deletes all chunks for a resource and leaves others untouched", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId: resourceA } = await seedResource(
      t,
      workspaceId,
      userId
    );
    const { resourceId: resourceB } = await seedResource(
      t,
      workspaceId,
      userId
    );

    const makeChunk = (rid: typeof resourceA, i: number) => ({
      resourceId: rid,
      workspaceId,
      chunkIndex: i,
      content: `content ${i}`,
      embedding: fakeEmbedding(`content ${i}`),
      model: "text-embedding-3-small",
      startOffset: i * 100,
      endOffset: (i + 1) * 100,
      contentHash: "hash",
    });

    await t.mutation(internal.resource.aiInternals.insertResourceChunks, {
      chunks: [makeChunk(resourceA, 0), makeChunk(resourceA, 1)],
    });
    await t.mutation(internal.resource.aiInternals.insertResourceChunks, {
      chunks: [makeChunk(resourceB, 0)],
    });

    await t.mutation(internal.resource.aiInternals.deleteResourceChunks, {
      resourceId: resourceA,
    });

    const remainingA = await t.run(async (ctx) =>
      ctx.db
        .query("resourceChunk")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceA))
        .collect()
    );
    const remainingB = await t.run(async (ctx) =>
      ctx.db
        .query("resourceChunk")
        .withIndex("by_resource", (q) => q.eq("resourceId", resourceB))
        .collect()
    );
    expect(remainingA).toHaveLength(0);
    expect(remainingB).toHaveLength(1);
  });
});

describe("setResourceAIStatus", () => {
  it("patches the status through pending → processing → completed", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId);

    await t.mutation(internal.resource.aiInternals.setResourceAIStatus, {
      resourceId,
      status: "processing",
    });
    let row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("processing");

    await t.mutation(internal.resource.aiInternals.setResourceAIStatus, {
      resourceId,
      status: "completed",
    });
    row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("completed");
    expect(row?.processedAt).toBeTypeOf("number");
  });

  it("records error and status=failed when transitioning to failed", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId);

    await t.mutation(internal.resource.aiInternals.setResourceAIStatus, {
      resourceId,
      status: "failed",
      error: "boom",
    });
    const row = await t.run(async (ctx) => ctx.db.get(aiRowId));
    expect(row?.status).toBe("failed");
    expect(row?.error).toBe("boom");
  });

  it("throws if the resourceAI row is missing", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const { resourceId, aiRowId } = await seedResource(t, workspaceId, userId);
    await t.run(async (ctx) => ctx.db.delete(aiRowId));

    await expect(
      t.mutation(internal.resource.aiInternals.setResourceAIStatus, {
        resourceId,
        status: "completed",
      })
    ).rejects.toThrow(/ResourceAI not found/);
  });
});

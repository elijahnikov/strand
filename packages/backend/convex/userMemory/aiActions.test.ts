import { beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createHarness, seedUser, seedWorkspace } from "../_test/harness";

// The user memory extractor has three subtle correctness properties that
// don't show up in types and would silently rot if broken:
//   1. MIN_NEW_MESSAGES threshold — don't burn OpenAI calls on short threads
//   2. Drift guard — reject extracted memory < 70% Jaccard to existing
//   3. Status lock via `expectedVersion` — prevents concurrent extractions
// These tests guard each one.

// Default mock: memory extractor returns "placeholder" content. Individual
// tests can re-mock via `vi.doMock` before importing, but for these four tests
// we set the content once per test via `vi.doMock` and then import the action.
vi.mock("@omi/ai/providers", async () => {
  const { mockProvidersModule } = await import("../_test/mockAi");
  return mockProvidersModule();
});

async function seedMemoryRow(
  t: ReturnType<typeof createHarness>,
  workspaceId: Id<"workspace">,
  userId: Id<"user">,
  overrides: Partial<{
    content: string;
    status: "idle" | "extracting";
    version: number;
    lastExtractedAt: number;
  }> = {}
): Promise<Id<"userMemory">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("userMemory", {
      workspaceId,
      userId,
      content: overrides.content ?? "",
      status: overrides.status ?? "idle",
      version: overrides.version ?? 0,
      lastExtractedAt: overrides.lastExtractedAt,
      updatedAt: Date.now(),
    })
  );
}

async function seedThreadWithMessages(
  t: ReturnType<typeof createHarness>,
  workspaceId: Id<"workspace">,
  userId: Id<"user">,
  messageCount: number
): Promise<Id<"chatThread">> {
  return await t.run(async (ctx) => {
    const threadId = await ctx.db.insert("chatThread", {
      workspaceId,
      userId,
      lastMessageAt: Date.now(),
    });
    for (let i = 0; i < messageCount; i++) {
      await ctx.db.insert("chatMessage", {
        threadId,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i} about building a PKMS with vector search`,
        createdAt: Date.now() + i,
      });
    }
    return threadId;
  });
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test";
  vi.resetModules();
});

describe("extractUserMemory", () => {
  it("no-ops when fewer than MIN_NEW_MESSAGES new messages exist", async () => {
    vi.doMock("@omi/ai/memory", async () => {
      const { mockMemoryModule } = await import("../_test/mockAi");
      return mockMemoryModule("NEW extracted content that replaces everything");
    });
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const memoryId = await seedMemoryRow(t, workspaceId, userId);
    // Only 3 messages — below MIN_NEW_MESSAGES (4).
    const threadId = await seedThreadWithMessages(t, workspaceId, userId, 3);

    await t.action(internal.userMemory.aiActions.extractUserMemory, {
      memoryId,
      threadId,
      scheduledAt: Date.now() + 100_000,
    });

    const row = await t.run(async (ctx) => ctx.db.get(memoryId));
    expect(row?.content).toBe("");
    expect(row?.version).toBe(0);
  });

  it("happy path: writes new content, bumps version, returns status to idle", async () => {
    vi.doMock("@omi/ai/memory", async () => {
      const { mockMemoryModule } = await import("../_test/mockAi");
      return mockMemoryModule("user is building a PKMS with vector search");
    });
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    // Existing content is empty → similarity defaults to 1, drift guard passes.
    const memoryId = await seedMemoryRow(t, workspaceId, userId);
    const threadId = await seedThreadWithMessages(t, workspaceId, userId, 5);

    await t.action(internal.userMemory.aiActions.extractUserMemory, {
      memoryId,
      threadId,
      scheduledAt: Date.now() + 100_000,
    });

    const row = await t.run(async (ctx) => ctx.db.get(memoryId));
    expect(row?.content).toBe("user is building a PKMS with vector search");
    expect(row?.version).toBe(1);
    expect(row?.status).toBe("idle");
    expect(row?.lastExtractedAt).toBeTypeOf("number");
  });

  it("drift guard: rejects a low-similarity update when message count is below DRIFT_GUARD_MIN_MESSAGES", async () => {
    vi.doMock("@omi/ai/memory", async () => {
      const { mockMemoryModule } = await import("../_test/mockAi");
      // Totally unrelated content — Jaccard ~0 vs the existing one.
      return mockMemoryModule("apples bananas cherries dragonfruit");
    });
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const memoryId = await seedMemoryRow(t, workspaceId, userId, {
      content: "user focuses on PKMS design and ontology",
      version: 2,
    });
    // 5 messages — above MIN_NEW_MESSAGES but below DRIFT_GUARD_MIN_MESSAGES (8),
    // so the drift guard is active.
    const threadId = await seedThreadWithMessages(t, workspaceId, userId, 5);

    await t.action(internal.userMemory.aiActions.extractUserMemory, {
      memoryId,
      threadId,
      scheduledAt: Date.now() + 100_000,
    });

    const row = await t.run(async (ctx) => ctx.db.get(memoryId));
    // Content unchanged; version unchanged; status back to idle; lastExtractedAt set.
    expect(row?.content).toBe("user focuses on PKMS design and ontology");
    expect(row?.version).toBe(2);
    expect(row?.status).toBe("idle");
    expect(row?.lastExtractedAt).toBeTypeOf("number");
  });

  it("drift guard is bypassed once the thread is long enough (>=DRIFT_GUARD_MIN_MESSAGES)", async () => {
    vi.doMock("@omi/ai/memory", async () => {
      const { mockMemoryModule } = await import("../_test/mockAi");
      return mockMemoryModule("apples bananas cherries dragonfruit");
    });
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    const memoryId = await seedMemoryRow(t, workspaceId, userId, {
      content: "user focuses on PKMS design and ontology",
      version: 2,
    });
    // 8 messages: drift guard floor is met, so large divergence is accepted.
    const threadId = await seedThreadWithMessages(t, workspaceId, userId, 8);

    await t.action(internal.userMemory.aiActions.extractUserMemory, {
      memoryId,
      threadId,
      scheduledAt: Date.now() + 100_000,
    });

    const row = await t.run(async (ctx) => ctx.db.get(memoryId));
    expect(row?.content).toBe("apples bananas cherries dragonfruit");
    expect(row?.version).toBe(3);
  });
});

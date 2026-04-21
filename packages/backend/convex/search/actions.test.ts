import { describe, expect, it, vi } from "vitest";
import {
  asUser,
  createHarness,
  seedResource,
  seedUser,
  seedWorkspace,
} from "../../test/harness";
import { api } from "../_generated/api";

// Workspace isolation regression guard. This is the single most important
// security invariant in search: a user in workspace A must never see resources
// from workspace B, regardless of how strong the match is.

// The action calls into `@omi/ai/*` only when an OPENAI_API_KEY is set and
// embeddings exist. For title-search-driven tests we leave the key unset so
// the action stays on the lexical path — no network calls, no mocks required.

const unauthorizedRegex = /Unauthorized/;
const notAuthorizedRegex = /Not authorized/;

vi.mock("@omi/ai/providers", async () => {
  const { mockProvidersModule } = await import("../../test/mockAi");
  return mockProvidersModule();
});
vi.mock("@omi/ai/embeddings", async () => {
  const { mockEmbeddingsModule } = await import("../../test/mockAi");
  return mockEmbeddingsModule();
});

describe("hybridSearch — auth", () => {
  it("throws when unauthenticated", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    await expect(
      t.action(api.search.actions.hybridSearch, {
        workspaceId,
        query: "hello",
      })
    ).rejects.toThrow(unauthorizedRegex);
  });

  it("throws Not authorized for a non-member", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { identity: strangerIdentity } = await seedUser(t);
    await expect(
      asUser(t, strangerIdentity).action(api.search.actions.hybridSearch, {
        workspaceId,
        query: "hello",
      })
    ).rejects.toThrow(notAuthorizedRegex);
  });
});

describe("hybridSearch — workspace isolation", () => {
  it("does not return resources from a different workspace even with identical titles", async () => {
    const t = createHarness();

    // Workspace A with its owner and one resource titled "shared topic".
    const { userId: userA, identity: identityA } = await seedUser(t);
    const workspaceA = await seedWorkspace(t, userA);
    const { resourceId: resourceInA } = await seedResource(
      t,
      workspaceA,
      userA,
      {
        title: "shared topic",
      }
    );

    // Workspace B with a different owner and a resource with the same title.
    const { userId: userB } = await seedUser(t);
    const workspaceB = await seedWorkspace(t, userB);
    const { resourceId: resourceInB } = await seedResource(
      t,
      workspaceB,
      userB,
      {
        title: "shared topic",
      }
    );

    const response = await asUser(t, identityA).action(
      api.search.actions.hybridSearch,
      { workspaceId: workspaceA, query: "shared topic" }
    );

    const ids = response.results.map((r) => r.resourceId);
    expect(ids).toContain(resourceInA);
    expect(ids).not.toContain(resourceInB);
  });
});

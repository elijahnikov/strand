import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it } from "vitest";
import {
  asUser,
  createHarness,
  seedMember,
  seedUser,
  seedWorkspace,
} from "../../test/harness";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decryptKey, encryptKey } from "./byoKeyActions";

beforeEach(() => {
  // 32-byte base64-encoded key (deterministic for tests).
  process.env.BYO_KEY_ENCRYPTION_KEY = Buffer.from(
    "0123456789abcdef0123456789abcdef"
  ).toString("base64");
});

describe("encryptKey / decryptKey", () => {
  it("round-trips a plaintext key", () => {
    const plaintext = "sk-test-1234567890";
    const ct = encryptKey(plaintext);
    expect(ct).not.toBe(plaintext);
    expect(decryptKey(ct)).toBe(plaintext);
  });

  it("produces different ciphertext on each encryption (random IV)", () => {
    const plaintext = "sk-same-key";
    const a = encryptKey(plaintext);
    const b = encryptKey(plaintext);
    expect(a).not.toBe(b);
    expect(decryptKey(a)).toBe(plaintext);
    expect(decryptKey(b)).toBe(plaintext);
  });

  it("rejects decryption with a different key (auth tag mismatch)", () => {
    const plaintext = "sk-test";
    const ct = encryptKey(plaintext);
    process.env.BYO_KEY_ENCRYPTION_KEY = Buffer.from(
      "ffffffffffffffffffffffffffffffff"
    ).toString("base64");
    expect(() => decryptKey(ct)).toThrow();
  });

  it("throws when the env key is missing", () => {
    process.env.BYO_KEY_ENCRYPTION_KEY = "";
    expect(() => encryptKey("sk-test")).toThrow(
      /BYO_KEY_ENCRYPTION_KEY not configured/
    );
  });
});

async function seedAdmin(t: ReturnType<typeof createHarness>): Promise<{
  ownerId: Id<"user">;
  adminId: Id<"user">;
  memberId: Id<"user">;
  workspaceId: Id<"workspace">;
  ownerIdentity: { subject: string; userId: string };
  adminIdentity: { subject: string; userId: string };
  memberIdentity: { subject: string; userId: string };
}> {
  const owner = await seedUser(t);
  const admin = await seedUser(t);
  const member = await seedUser(t);
  const workspaceId = await seedWorkspace(t, owner.userId);
  await seedMember(t, workspaceId, admin.userId, "admin");
  await seedMember(t, workspaceId, member.userId, "member");
  return {
    ownerId: owner.userId,
    adminId: admin.userId,
    memberId: member.userId,
    workspaceId,
    ownerIdentity: owner.identity,
    adminIdentity: admin.identity,
    memberIdentity: member.identity,
  };
}

describe("upsertKeyInternal / deleteKeyInternal", () => {
  it("inserts a row and encryption round-trips through the DB", async () => {
    const t = createHarness();
    const { workspaceId, ownerId } = await seedAdmin(t);
    const ciphertext = encryptKey("sk-abc");
    await t.mutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId,
      provider: "openai",
      encryptedApiKey: ciphertext,
      model: "gpt-4.1-mini",
      createdByUserId: ownerId,
    });

    const row = await t.query(internal.billing.byoKey.getProviderRowInternal, {
      workspaceId,
    });
    expect(row).not.toBeNull();
    expect(row?.provider).toBe("openai");
    expect(decryptKey(row?.encryptedApiKey ?? "")).toBe("sk-abc");
  });

  it("upsert replaces the prior row for the workspace", async () => {
    const t = createHarness();
    const { workspaceId, ownerId } = await seedAdmin(t);
    await t.mutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId,
      provider: "openai",
      encryptedApiKey: encryptKey("sk-first"),
      createdByUserId: ownerId,
    });
    await t.mutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId,
      provider: "google",
      encryptedApiKey: encryptKey("gg-second"),
      model: "gemini-2.5-pro",
      createdByUserId: ownerId,
    });

    const row = await t.query(internal.billing.byoKey.getProviderRowInternal, {
      workspaceId,
    });
    expect(row?.provider).toBe("google");
    expect(decryptKey(row?.encryptedApiKey ?? "")).toBe("gg-second");
    expect(row?.model).toBe("gemini-2.5-pro");
  });
});

describe("getWorkspaceProvider / removeWorkspaceKey", () => {
  it("reports hasKey=false and admin flag for an admin user with no row", async () => {
    const t = createHarness();
    const { workspaceId, adminIdentity } = await seedAdmin(t);
    const { api } = await import("../_generated/api");
    const state = await asUser(t, adminIdentity).query(
      api.billing.byoKey.getWorkspaceProvider,
      { workspaceId }
    );
    expect(state.hasKey).toBe(false);
    expect(state.isAdmin).toBe(true);
  });

  it("reports isAdmin=false for a regular member", async () => {
    const t = createHarness();
    const { workspaceId, memberIdentity } = await seedAdmin(t);
    const { api } = await import("../_generated/api");
    const state = await asUser(t, memberIdentity).query(
      api.billing.byoKey.getWorkspaceProvider,
      { workspaceId }
    );
    expect(state.isAdmin).toBe(false);
  });

  it("non-admin member cannot call removeWorkspaceKey", async () => {
    const t = createHarness();
    const { workspaceId, memberIdentity, ownerId } = await seedAdmin(t);
    await t.mutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId,
      provider: "openai",
      encryptedApiKey: encryptKey("sk-to-remove"),
      createdByUserId: ownerId,
    });
    const { api } = await import("../_generated/api");
    await expect(
      asUser(t, memberIdentity).mutation(
        api.billing.byoKey.removeWorkspaceKey,
        { workspaceId }
      )
    ).rejects.toThrow(ConvexError);
  });

  it("admin can remove the key; falls back to platform default", async () => {
    const t = createHarness();
    const { workspaceId, adminIdentity, ownerId } = await seedAdmin(t);
    await t.mutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId,
      provider: "openai",
      encryptedApiKey: encryptKey("sk-bye"),
      createdByUserId: ownerId,
    });
    const { api } = await import("../_generated/api");
    await asUser(t, adminIdentity).mutation(
      api.billing.byoKey.removeWorkspaceKey,
      { workspaceId }
    );
    const row = await t.query(internal.billing.byoKey.getProviderRowInternal, {
      workspaceId,
    });
    expect(row).toBeNull();
  });
});

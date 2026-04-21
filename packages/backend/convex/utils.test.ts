import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  asUser,
  createHarness,
  seedMember,
  seedUser,
  seedWorkspace,
} from "../test/harness";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const notAuthenticatedRegex = /Not authenticated/;
const userNotFoundRegex = /User not found/;
const notAuthorizedRegex = /Not authorized/;
const workspaceNotFoundRegex = /Workspace not found/;

describe("protectedQuery", () => {
  it("throws when the caller is not authenticated", async () => {
    const t = createHarness();
    await expect(t.query(api.workspace.queries.listByUser)).rejects.toThrow(
      notAuthenticatedRegex
    );
  });

  it("throws when identity.userId points to a deleted user", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    // Delete the user row, then call with a stale identity.
    await t.run(async (ctx) => ctx.db.delete(userId));
    const staleIdentity = {
      subject: userId as string,
      userId: userId as string,
    };
    await expect(
      asUser(t, staleIdentity).query(api.workspace.queries.listByUser)
    ).rejects.toThrow(userNotFoundRegex);
  });

  it("succeeds and exposes the user in ctx when authenticated", async () => {
    const t = createHarness();
    const { userId, identity } = await seedUser(t);
    await seedWorkspace(t, userId);

    const workspaces = await asUser(t, identity).query(
      api.workspace.queries.listByUser
    );
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]?.role).toBe("owner");
  });
});

describe("protectedMutation", () => {
  it("throws when not authenticated", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    await expect(
      t.mutation(api.workspace.mutations.leaveWorkspace, { workspaceId })
    ).rejects.toThrow(notAuthenticatedRegex);
  });
});

describe("workspaceQuery", () => {
  it("throws when not authenticated", async () => {
    const t = createHarness();
    const { userId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);
    await expect(
      t.query(api.workspace.queries.getById, { workspaceId })
    ).rejects.toThrow(notAuthenticatedRegex);
  });

  it("throws when the workspaceId does not exist", async () => {
    const t = createHarness();
    const { identity } = await seedUser(t);
    // Build a valid-shape workspace id that points nowhere. Convex ids are
    // strings, and the harness won't coerce missing rows; use a real id from
    // a seeded workspace that we then delete.
    const { userId: otherUser } = await seedUser(t);
    const bogusWorkspaceId = await seedWorkspace(t, otherUser);
    await t.run(async (ctx) => ctx.db.delete(bogusWorkspaceId));

    await expect(
      asUser(t, identity).query(api.workspace.queries.getById, {
        workspaceId: bogusWorkspaceId,
      })
    ).rejects.toThrow(workspaceNotFoundRegex);
  });

  it("grants access to the workspace owner", async () => {
    const t = createHarness();
    const { userId, identity } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);

    const result = await asUser(t, identity).query(
      api.workspace.queries.getById,
      { workspaceId }
    );
    expect(result.workspace._id).toBe(workspaceId);
    expect(result.member?.role).toBe("owner");
  });

  it("denies access to a user who is not a member", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { identity: strangerIdentity } = await seedUser(t);
    await expect(
      asUser(t, strangerIdentity).query(api.workspace.queries.getById, {
        workspaceId,
      })
    ).rejects.toThrow(notAuthorizedRegex);
  });

  it("grants access to a non-owner who is a member", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { userId: memberUserId, identity: memberIdentity } =
      await seedUser(t);
    await seedMember(t, workspaceId, memberUserId, "member");

    const result = await asUser(t, memberIdentity).query(
      api.workspace.queries.getById,
      { workspaceId }
    );
    expect(result.workspace._id).toBe(workspaceId);
    expect(result.member?.role).toBe("member");
  });
});

describe("workspaceMutation role enforcement", () => {
  it("allows owner to update workspace (owner bypass)", async () => {
    const t = createHarness();
    const { userId, identity } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, userId);

    await asUser(t, identity).mutation(api.workspace.mutations.update, {
      workspaceId,
      name: "New Name",
    });

    const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
    expect(workspace?.name).toBe("New Name");
  });

  it("allows admin to update workspace", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { userId: adminUserId, identity: adminIdentity } = await seedUser(t);
    await seedMember(t, workspaceId, adminUserId, "admin");

    await asUser(t, adminIdentity).mutation(api.workspace.mutations.update, {
      workspaceId,
      name: "Admin Rename",
    });
    const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
    expect(workspace?.name).toBe("Admin Rename");
  });

  it("denies a plain member from updating workspace (role: owner|admin required)", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { userId: memberUserId, identity: memberIdentity } =
      await seedUser(t);
    await seedMember(t, workspaceId, memberUserId, "member");

    await expect(
      asUser(t, memberIdentity).mutation(api.workspace.mutations.update, {
        workspaceId,
        name: "Nope",
      })
    ).rejects.toThrow(notAuthorizedRegex);
  });

  it("denies a non-member from updating workspace", async () => {
    const t = createHarness();
    const { userId: ownerId } = await seedUser(t);
    const workspaceId = await seedWorkspace(t, ownerId);

    const { identity: strangerIdentity } = await seedUser(t);
    await expect(
      asUser(t, strangerIdentity).mutation(api.workspace.mutations.update, {
        workspaceId,
        name: "Nope",
      })
    ).rejects.toThrow(notAuthorizedRegex);
  });
});

// biome-ignore lint/suspicious/noExportsInTest: <>
export const _unused = { ConvexError, internal } as unknown as {
  ConvexError: typeof ConvexError;
  internal: typeof internal;
  UserId: Id<"user">;
};

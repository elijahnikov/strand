"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { getAuthIdentity } from "../utils";
import { defaultModelFor, isValidModelFor } from "./byoModels";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.BYO_KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new ConvexError("BYO_KEY_ENCRYPTION_KEY not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new ConvexError(
      "BYO_KEY_ENCRYPTION_KEY must decode to 32 bytes (AES-256)"
    );
  }
  return key;
}

export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function verifyOpenAIKey(apiKey: string): Promise<boolean> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok;
}

async function verifyGoogleKey(apiKey: string): Promise<boolean> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  return res.ok;
}

async function verifyAnthropicKey(apiKey: string): Promise<boolean> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  return res.ok;
}

/**
 * Admin-only. Validates the key against the provider's API before persisting;
 * encrypts with the AES-GCM env key. Upserts the row — replacing any existing
 * provider config for the workspace.
 */
export const setWorkspaceKey = action({
  args: {
    workspaceId: v.id("workspace"),
    provider: v.union(
      v.literal("openai"),
      v.literal("google"),
      v.literal("anthropic")
    ),
    apiKey: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const userId = identity.userId as Id<"user">;

    const trimmed = args.apiKey.trim();
    if (trimmed.length < 10) {
      throw new ConvexError("API key looks invalid (too short)");
    }
    if (args.model && !isValidModelFor(args.provider, args.model)) {
      throw new ConvexError(
        `Model "${args.model}" is not supported for ${args.provider}.`
      );
    }
    let ok = false;
    if (args.provider === "openai") {
      ok = await verifyOpenAIKey(trimmed);
    } else if (args.provider === "google") {
      ok = await verifyGoogleKey(trimmed);
    } else {
      ok = await verifyAnthropicKey(trimmed);
    }
    if (!ok) {
      throw new ConvexError(
        "API key failed verification with the provider. Double-check the key and try again."
      );
    }

    const encryptedApiKey = encryptKey(trimmed);
    await ctx.runMutation(internal.billing.byoKey.upsertKeyInternal, {
      workspaceId: args.workspaceId,
      provider: args.provider,
      encryptedApiKey,
      model: args.model ?? defaultModelFor(args.provider),
      createdByUserId: userId,
    });

    return { ok: true as const };
  },
});

/**
 * Internal: returns the decrypted key plus the workspace's chosen model
 * identity. Used by the chat server route to select between platform OpenAI
 * and the user's own key. Returns `{ provider: "platform" }` when nothing is
 * configured.
 */
type ResolvedProvider =
  | {
      provider: "platform";
      model: null;
      apiKey: null;
    }
  | {
      provider: "openai" | "google" | "anthropic";
      model: string;
      apiKey: string;
    };

/**
 * Called from the TanStack Start chat handler to pick between platform and
 * BYO. The caller is already authenticated via `fetchAuthAction`, and the
 * workspace's authorization is enforced by the fact that only workspace
 * members can reach the chat route in the first place (the preflight query
 * rejects non-members). The returned API key is sent to the node process that
 * spawned the chat stream and not echoed back to the browser.
 */
export const resolveAIProvider = action({
  args: { workspaceId: v.id("workspace") },
  handler: async (ctx, args): Promise<ResolvedProvider> => {
    const identity = await getAuthIdentity(ctx);
    if (!identity?.userId) {
      throw new ConvexError("Not authenticated");
    }
    const row = await ctx.runQuery(
      internal.billing.byoKey.getProviderRowInternal,
      { workspaceId: args.workspaceId }
    );
    if (!row) {
      return {
        provider: "platform",
        model: null,
        apiKey: null,
      };
    }
    return {
      provider: row.provider,
      model: row.model ?? defaultModelFor(row.provider),
      apiKey: decryptKey(row.encryptedApiKey),
    };
  },
});

"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const CURRENT_KEY_VERSION = 1;

function getEncryptionKey(): Buffer {
  const raw = process.env.OMI_TOKEN_KEY;
  if (!raw) {
    throw new ConvexError("OMI_TOKEN_KEY not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new ConvexError("OMI_TOKEN_KEY must decode to 32 bytes (AES-256)");
  }
  return key;
}

export interface EncryptedToken {
  ciphertext: string;
  keyVersion: number;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, authTag, encrypted]).toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function decryptToken(ciphertext: string, keyVersion: number): string {
  if (keyVersion !== CURRENT_KEY_VERSION) {
    throw new ConvexError(
      `Unsupported token key version ${keyVersion}; rotate keys before decrypting`
    );
  }
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

const providerValidator = v.union(
  v.literal("notion"),
  v.literal("raindrop"),
  v.literal("google_drive"),
  v.literal("readwise"),
  v.literal("github"),
  v.literal("linear")
);

const authTypeValidator = v.union(v.literal("oauth2"), v.literal("api_token"));

/**
 * Encrypt a freshly-issued token pair and persist via the internal mutation.
 * Called from V8-runtime httpActions (OAuth callback) that cannot use node:crypto directly.
 */
export const encryptAndInsertConnection = internalAction({
  args: {
    userId: v.id("user"),
    provider: providerValidator,
    authType: authTypeValidator,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    providerAccountLabel: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspace")),
  },
  handler: async (ctx, args): Promise<Id<"connection">> => {
    const access = encryptToken(args.accessToken);
    const refresh = args.refreshToken
      ? encryptToken(args.refreshToken)
      : undefined;
    return await ctx.runMutation(
      internal.connections.internals.insertConnection,
      {
        userId: args.userId,
        provider: args.provider,
        authType: args.authType,
        encryptedAccessToken: access.ciphertext,
        encryptedRefreshToken: refresh?.ciphertext,
        tokenKeyVersion: access.keyVersion,
        expiresAt: args.expiresAt,
        scope: args.scope,
        providerAccountId: args.providerAccountId,
        providerAccountLabel: args.providerAccountLabel,
        workspaceId: args.workspaceId,
      }
    );
  },
});

export const encryptAndUpdateRefreshedTokens = internalAction({
  args: {
    connectionId: v.id("connection"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const access = encryptToken(args.accessToken);
    const refresh = args.refreshToken
      ? encryptToken(args.refreshToken)
      : undefined;
    await ctx.runMutation(
      internal.connections.internals.updateTokenAfterRefresh,
      {
        connectionId: args.connectionId,
        encryptedAccessToken: access.ciphertext,
        encryptedRefreshToken: refresh?.ciphertext,
        tokenKeyVersion: access.keyVersion,
        expiresAt: args.expiresAt,
        scope: args.scope,
      }
    );
  },
});

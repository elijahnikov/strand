"use node";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { encryptToken } from "./tokens";

/**
 * One-shot migration: re-encrypts any connection row that still has a plaintext
 * accessToken/refreshToken, then clears the legacy plaintext fields.
 *
 * Run once via `npx convex run connections/encryptTokensMigrationAction:run`
 * after the encryption code is deployed and OMI_TOKEN_KEY is configured.
 *
 * Idempotent: rows already encrypted (encryptedAccessToken set) are skipped.
 */
export const run = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{ scanned: number; migrated: number; skipped: number }> => {
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    let cursor: string | undefined;

    while (true) {
      const page: {
        rows: Array<{
          _id: Id<"connection">;
          accessToken: string | undefined;
          refreshToken: string | undefined;
          hasEncrypted: boolean;
        }>;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(
        internal.connections.encryptTokensMigration.listPlaintextRows,
        { cursor }
      );

      for (const row of page.rows) {
        scanned += 1;
        if (row.hasEncrypted) {
          skipped += 1;
          continue;
        }
        if (!row.accessToken) {
          skipped += 1;
          continue;
        }
        const access = encryptToken(row.accessToken);
        const refresh = row.refreshToken
          ? encryptToken(row.refreshToken)
          : undefined;
        await ctx.runMutation(
          internal.connections.encryptTokensMigration.writeEncryptedTokens,
          {
            connectionId: row._id,
            encryptedAccessToken: access.ciphertext,
            encryptedRefreshToken: refresh?.ciphertext,
            tokenKeyVersion: access.keyVersion,
          }
        );
        migrated += 1;
      }

      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    return { scanned, migrated, skipped };
  },
});

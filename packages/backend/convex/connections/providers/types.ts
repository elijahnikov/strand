export type ProviderId =
  | "notion"
  | "raindrop"
  | "google_drive"
  | "readwise"
  | "github"
  | "linear";

export type AuthType = "oauth2" | "api_token";

export interface ProviderAccountInfo {
  providerAccountId?: string;
  providerAccountLabel?: string;
}

/**
 * Canonical upsert shape produced by a provider's sync.toResource(). The sync
 * worker hands these to `applyUpsertSyncedResource` which maps them onto the
 * resource / noteResource / websiteResource / fileResource tables.
 */
export interface ResourceUpsert {
  externalId: string;
  externalUrl?: string;
  type: "website" | "note" | "file";
  title: string;
  description?: string;
  // Polymorphic payload — the worker dispatches by `type`.
  note?: {
    htmlContent?: string;
    jsonContent?: string;
    plainTextContent?: string;
  };
  website?: {
    url: string;
    domain?: string;
    favicon?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    siteName?: string;
    articleContent?: string;
  };
  // File ingestion is not in v1 of sync (would require fetching binary into Convex storage).
}

export interface WebhookEvent {
  kind: "upsert" | "delete";
  externalId: string;
  // Provider-supplied unique ID for this delivery (used for dedupe via syncEvent table).
  eventId: string;
  // For integration-level webhook URLs (Notion, GitHub) this identifies which
  // connection the event belongs to — looked up by `connection.providerAccountId`.
  // Required when the URL is shared across all connections of a provider.
  connectionLookupKey?: string;
  // Optional inline payload — when absent, the worker calls fetchOne(externalId).
  rawItem?: unknown;
}

export type WebhookParseResult =
  // Notion-style ownership-proof: provider sends a one-time POST containing a
  // verification token that we surface to the operator (e.g. via logs) so they
  // can paste it back into the provider's integration settings.
  | { kind: "verification"; verificationToken: string }
  | { kind: "events"; events: WebhookEvent[] };

export interface SyncBatch {
  items: unknown[];
  cursor?: string;
  done: boolean;
}

export interface SyncContext {
  accessToken: string;
  scopeSelection: unknown;
  workspaceId: string;
  connectionId: string;
}

/**
 * Per-provider sync logic. Attached to a provider descriptor when the provider
 * supports continuous (Pro-only) sync.
 */
export interface ProviderSync {
  // "webhook": real-time push, no scheduled polling.
  // "poll":    no webhook support; rely on cron poll fallback.
  // "hybrid":  webhook primary + low-frequency poll for catch-up.
  kind: "webhook" | "poll" | "hybrid";

  // Yields items changed since `cursor`. Used by both the cron fallback and
  // catch-up after webhook downtime. Sync starts from the moment enableSync
  // was called — see mutations.enableSync for cursor seeding.
  pollDelta(
    ctx: SyncContext & { cursor: string | undefined }
  ): AsyncIterable<SyncBatch>;

  // Parse a webhook delivery. Provider implementations:
  //   - read their own HMAC secret from env (e.g. NOTION_WEBHOOK_TOKEN)
  //   - detect the provider's verification flow and surface that token via
  //     `kind: "verification"` so the operator can finish setup
  //   - return `kind: "events"` with normalized events for real deliveries
  // Returns null when the signature fails (handler should 401).
  parseWebhook?(req: Request): Promise<WebhookParseResult | null>;

  // Fetch a single item by external ID (used when webhooks ship IDs only).
  fetchOne?(
    ctx: SyncContext,
    externalId: string
  ): Promise<unknown | null>;

  // Map a raw provider item to a canonical ResourceUpsert.
  toResource(rawItem: unknown, ctx: SyncContext): ResourceUpsert;
}

export interface OAuth2ProviderDescriptor {
  authorizeExtraParams?: Record<string, string>;
  authorizeUrl: string;
  authType: "oauth2";
  clientId: string | undefined;
  clientSecret: string | undefined;
  // The raw token-response body is passed in so providers (e.g. Notion) can
  // extract provider-specific fields like workspace_id that aren't part of the
  // standard OAuth response and aren't exposed by the user-info endpoint.
  fetchAccountInfo: (
    accessToken: string,
    rawTokenResponse?: Record<string, unknown>
  ) => Promise<ProviderAccountInfo>;
  id: ProviderId;
  label: string;
  scopes: string[];
  tokenAuthStyle?: "header" | "body";
  tokenUrl: string;
  // Present when this provider supports continuous (Pro-only) sync.
  sync?: ProviderSync;
}

export interface ApiTokenProviderDescriptor {
  authType: "api_token";
  id: ProviderId;
  label: string;
  validateToken: (token: string) => Promise<ProviderAccountInfo>;
  sync?: ProviderSync;
}

export type ProviderDescriptor =
  | OAuth2ProviderDescriptor
  | ApiTokenProviderDescriptor;

export function getProviderSync(
  descriptor: ProviderDescriptor
): ProviderSync | undefined {
  return descriptor.sync;
}

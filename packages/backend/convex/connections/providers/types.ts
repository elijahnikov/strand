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

export interface ResourceUpsert {
  description?: string;
  externalId: string;
  externalUrl?: string;
  note?: {
    htmlContent?: string;
    jsonContent?: string;
    plainTextContent?: string;
  };
  title: string;
  type: "website" | "note" | "file";
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
}

export interface WebhookEvent {
  connectionLookupKey?: string;
  eventId: string;
  externalId: string;
  kind: "upsert" | "delete";
  rawItem?: unknown;
}

export type WebhookParseResult =
  | { kind: "verification"; verificationToken: string }
  | { kind: "events"; events: WebhookEvent[] };

export interface SyncBatch {
  cursor?: string;
  done: boolean;
  items: unknown[];
}

export interface SyncContext {
  accessToken: string;
  connectionId: string;
  scopeSelection: unknown;
  workspaceId: string;
}

export interface ProviderSync {
  fetchOne?(ctx: SyncContext, externalId: string): Promise<unknown | null>;
  kind: "webhook" | "poll" | "hybrid";

  parseWebhook?(
    req: Request,
    secret?: string
  ): Promise<WebhookParseResult | null>;

  pollDelta(
    ctx: SyncContext & { cursor: string | undefined }
  ): AsyncIterable<SyncBatch>;

  toResource(rawItem: unknown, ctx: SyncContext): ResourceUpsert;
}

export interface OAuth2ProviderDescriptor {
  authorizeExtraParams?: Record<string, string>;
  authorizeUrl: string;
  authType: "oauth2";
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetchAccountInfo: (
    accessToken: string,
    rawTokenResponse?: Record<string, unknown>
  ) => Promise<ProviderAccountInfo>;
  id: ProviderId;
  label: string;
  scopes: string[];
  sync?: ProviderSync;
  tokenAuthStyle?: "header" | "body";
  tokenUrl: string;
}

export interface ApiTokenProviderDescriptor {
  authType: "api_token";
  id: ProviderId;
  label: string;
  sync?: ProviderSync;
  validateToken: (token: string) => Promise<ProviderAccountInfo>;
}

export type ProviderDescriptor =
  | OAuth2ProviderDescriptor
  | ApiTokenProviderDescriptor;

export function getProviderSync(
  descriptor: ProviderDescriptor
): ProviderSync | undefined {
  return descriptor.sync;
}

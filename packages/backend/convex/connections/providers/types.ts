export type ProviderId = "notion" | "raindrop" | "google_drive" | "readwise";

export type AuthType = "oauth2" | "api_token";

export interface ProviderAccountInfo {
  providerAccountId?: string;
  providerAccountLabel?: string;
}

export interface OAuth2ProviderDescriptor {
  authorizeExtraParams?: Record<string, string>;
  authorizeUrl: string;
  authType: "oauth2";
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetchAccountInfo: (accessToken: string) => Promise<ProviderAccountInfo>;
  id: ProviderId;
  label: string;
  scopes: string[];
  tokenAuthStyle?: "header" | "body";
  tokenUrl: string;
}

export interface ApiTokenProviderDescriptor {
  authType: "api_token";
  id: ProviderId;
  label: string;
  validateToken: (token: string) => Promise<ProviderAccountInfo>;
}

export type ProviderDescriptor =
  | OAuth2ProviderDescriptor
  | ApiTokenProviderDescriptor;

import { googleDrive } from "./google_drive";
import { notion } from "./notion";
import { raindrop } from "./raindrop";
import { readwise } from "./readwise";
import type {
  ApiTokenProviderDescriptor,
  OAuth2ProviderDescriptor,
  ProviderDescriptor,
  ProviderId,
} from "./types";

const providers: Record<ProviderId, ProviderDescriptor> = {
  notion,
  raindrop,
  google_drive: googleDrive,
  readwise,
};

export function getProvider(id: ProviderId): ProviderDescriptor {
  return providers[id];
}

export function getOAuth2Provider(id: ProviderId): OAuth2ProviderDescriptor {
  const descriptor = providers[id];
  if (descriptor.authType !== "oauth2") {
    throw new Error(`Provider ${id} is not an OAuth 2.0 provider`);
  }
  return descriptor;
}

export function getApiTokenProvider(
  id: ProviderId
): ApiTokenProviderDescriptor {
  const descriptor = providers[id];
  if (descriptor.authType !== "api_token") {
    throw new Error(`Provider ${id} is not an API-token provider`);
  }
  return descriptor;
}

export function isProviderId(value: string): value is ProviderId {
  return value in providers;
}

export function listProviders(): ProviderDescriptor[] {
  return Object.values(providers);
}

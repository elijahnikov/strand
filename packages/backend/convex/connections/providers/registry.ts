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

const providers: Partial<Record<ProviderId, ProviderDescriptor>> = {
  notion,
  raindrop,
  google_drive: googleDrive,
  readwise,
};

export function getProvider(id: ProviderId): ProviderDescriptor {
  const descriptor = providers[id];
  if (!descriptor) {
    throw new Error(`Provider ${id} is not registered`);
  }
  return descriptor;
}

export function getOAuth2Provider(id: ProviderId): OAuth2ProviderDescriptor {
  const descriptor = getProvider(id);
  if (descriptor.authType !== "oauth2") {
    throw new Error(`Provider ${id} is not an OAuth 2.0 provider`);
  }
  return descriptor;
}

export function getApiTokenProvider(
  id: ProviderId
): ApiTokenProviderDescriptor {
  const descriptor = getProvider(id);
  if (descriptor.authType !== "api_token") {
    throw new Error(`Provider ${id} is not an API-token provider`);
  }
  return descriptor;
}

export function isProviderId(value: string): value is ProviderId {
  return value in providers;
}

export function listProviders(): ProviderDescriptor[] {
  return Object.values(providers).filter(
    (p): p is ProviderDescriptor => p !== undefined
  );
}

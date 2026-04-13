const TOKEN_PREFIX = "strand_ext_";
const TOKEN_RANDOM_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

export function generateExtensionToken(): string {
  const bytes = new Uint8Array(TOKEN_RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  return `${TOKEN_PREFIX}${toBase64Url(bytes)}`;
}

export async function hashExtensionToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(new Uint8Array(digest));
}

export function isExtensionTokenShape(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}

export const DEFAULT_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

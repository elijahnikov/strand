interface StatePayload {
  nonce: string;
  provider: string;
  returnTo: string;
  userId: string;
}

const encoder = new TextEncoder();
const BASE64_PADDING_RE = /=+$/;

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_PADDING_RE, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLength));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "OAUTH_STATE_SECRET env var must be set and at least 16 characters"
    );
  }
  return secret;
}

export async function signState(payload: StatePayload): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64UrlEncode(signature)}`;
}

export async function verifyState(value: string): Promise<StatePayload | null> {
  const dot = value.indexOf(".");
  if (dot < 0) {
    return null;
  }
  const body = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const key = await importKey(getSecret());
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(body)
  );
  if (!valid) {
    return null;
  }
  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(body));
    return JSON.parse(decoded) as StatePayload;
  } catch {
    return null;
  }
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return base64UrlEncode(bytes);
}

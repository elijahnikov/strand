import { ConvexHttpClient } from "convex/browser";
import { getToken } from "@/lib/auth";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

export class MissingAuthError extends Error {
  constructor() {
    super("Extension is not connected to a omi account.");
    this.name = "MissingAuthError";
  }
}

export class MissingConvexUrlError extends Error {
  constructor() {
    super(
      "VITE_CONVEX_URL is not set. Add it to the root .env before building the extension."
    );
    this.name = "MissingConvexUrlError";
  }
}

export async function getConvexClient(): Promise<ConvexHttpClient> {
  if (!CONVEX_URL) {
    throw new MissingConvexUrlError();
  }
  const auth = await getToken();
  if (!auth) {
    throw new MissingAuthError();
  }
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(auth.token);
  return client;
}

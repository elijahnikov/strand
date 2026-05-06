import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import { getProvider, isProviderId } from "../providers/registry";

const PREFIX = "/api/integrations/";
const SUFFIX = "/webhook";

function parseProvider(pathname: string): string | null {
  if (!pathname.startsWith(PREFIX)) {
    return null;
  }
  const rest = pathname.slice(PREFIX.length);
  if (!rest.endsWith(SUFFIX)) {
    return null;
  }
  const provider = rest.slice(0, -SUFFIX.length);
  if (!provider || provider.includes("/")) {
    return null;
  }
  return provider;
}

export const webhookHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const providerId = parseProvider(url.pathname);
  if (!(providerId && isProviderId(providerId))) {
    return new Response("Not found", { status: 404 });
  }

  const descriptor = getProvider(providerId);
  if (!descriptor.sync?.parseWebhook) {
    return new Response("Provider does not accept webhooks", { status: 400 });
  }

  let parsed: Awaited<ReturnType<typeof descriptor.sync.parseWebhook>>;
  try {
    parsed = await descriptor.sync.parseWebhook(request);
  } catch (err) {
    console.warn("[webhook] parse threw", providerId, err);
    return new Response("Bad request", { status: 400 });
  }
  if (!parsed) {
    return new Response("Bad signature", { status: 401 });
  }

  if (parsed.kind === "verification") {
    console.warn(
      `[webhook] ${providerId} verification token (set as ${providerId.toUpperCase()}_WEBHOOK_TOKEN env var): ${parsed.verificationToken}`
    );
    return new Response(
      JSON.stringify({ verification_token: parsed.verificationToken }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  for (const event of parsed.events) {
    if (!event.connectionLookupKey) {
      console.warn(
        "[webhook] event missing connectionLookupKey",
        providerId,
        event.eventId
      );
      continue;
    }
    const conn = await ctx.runQuery(
      internal.connections.sync.internals.findConnectionByProviderAccount,
      {
        provider: providerId,
        providerAccountId: event.connectionLookupKey,
      }
    );
    if (!conn) {
      continue;
    }
    const connectionId = conn._id as Id<"connection">;

    const isNew: boolean = await ctx.runMutation(
      internal.connections.sync.internals.recordSyncEvent,
      { connectionId, providerEventId: event.eventId }
    );
    if (!isNew) {
      continue;
    }

    await ctx.runMutation(
      internal.connections.sync.internals.markWebhookReceived,
      { connectionId }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.connections.sync.worker.applyWebhookEvent,
      {
        connectionId,
        provider: providerId,
        kind: event.kind,
        externalId: event.externalId,
        rawItemJson: event.rawItem ? JSON.stringify(event.rawItem) : undefined,
      }
    );
  }

  return new Response(null, { status: 204 });
});

const PER_CONN_PREFIX_RE =
  /^\/api\/integrations\/([^/]+)\/webhook\/([^/]+)\/?$/;

export const webhookHandlerByConnection = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const match = url.pathname.match(PER_CONN_PREFIX_RE);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const providerId = match[1] as string;
  const connectionIdParam = match[2] as string;
  if (!isProviderId(providerId)) {
    return new Response("Unknown provider", { status: 404 });
  }

  const descriptor = getProvider(providerId);
  if (!descriptor.sync?.parseWebhook) {
    return new Response("Provider does not accept webhooks", { status: 400 });
  }

  const connectionId = connectionIdParam as Id<"connection">;
  const conn = await ctx.runQuery(
    internal.connections.sync.internals.getActiveConnectionForSync,
    { connectionId }
  );
  if (!conn) {
    return new Response("Connection not found or inactive", { status: 404 });
  }
  if (!conn.webhookSecret) {
    return new Response("Connection has no webhook secret", { status: 400 });
  }

  let parsed: Awaited<ReturnType<typeof descriptor.sync.parseWebhook>>;
  try {
    parsed = await descriptor.sync.parseWebhook(request, conn.webhookSecret);
  } catch (err) {
    console.warn("[webhook] parse threw", providerId, err);
    return new Response("Bad request", { status: 400 });
  }
  if (!parsed) {
    return new Response("Bad signature", { status: 401 });
  }

  if (parsed.kind === "verification") {
    console.warn(
      `[webhook] ${providerId} verification token: ${parsed.verificationToken}`
    );
    return new Response(null, { status: 200 });
  }

  await ctx.runMutation(
    internal.connections.sync.internals.markWebhookReceived,
    { connectionId }
  );

  for (const event of parsed.events) {
    const isNew: boolean = await ctx.runMutation(
      internal.connections.sync.internals.recordSyncEvent,
      { connectionId, providerEventId: event.eventId }
    );
    if (!isNew) {
      continue;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.connections.sync.worker.applyWebhookEvent,
      {
        connectionId,
        provider: providerId,
        kind: event.kind,
        externalId: event.externalId,
        rawItemJson: event.rawItem ? JSON.stringify(event.rawItem) : undefined,
      }
    );
  }

  return new Response(null, { status: 204 });
});

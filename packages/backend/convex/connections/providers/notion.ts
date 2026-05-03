import type {
  OAuth2ProviderDescriptor,
  ProviderSync,
  ResourceUpsert,
  SyncBatch,
  SyncContext,
  WebhookEvent,
  WebhookParseResult,
} from "./types";

const NOTION_VERSION = "2022-06-28";
const SEARCH_PAGE_SIZE = 50;

interface NotionBotUser {
  bot?: {
    workspace_name?: string;
    owner?: { user?: { person?: { email?: string }; name?: string } };
  };
  id: string;
  name?: string;
}

interface NotionRichText {
  plain_text?: string;
}

interface NotionPage {
  archived?: boolean;
  id: string;
  in_trash?: boolean;
  last_edited_time: string;
  object: "page";
  properties?: Record<
    string,
    {
      title?: NotionRichText[];
      type?: string;
    }
  >;
  url?: string;
}

interface NotionSearchResponse {
  has_more: boolean;
  next_cursor: string | null;
  results: NotionPage[];
}

interface NotionBlock {
  id: string;
  type: string;
  // Each block type stores its rich_text under a key matching its type name.
  [key: string]:
    | { rich_text?: NotionRichText[] }
    | string
    | boolean
    | undefined;
}

interface NotionBlockChildrenResponse {
  has_more: boolean;
  next_cursor: string | null;
  results: NotionBlock[];
}

interface NotionItem {
  page: NotionPage;
  plaintext: string;
  html: string;
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

function blockToHtml(block: NotionBlock, text: string): string | null {
  if (text.length === 0 && block.type !== "divider") {
    return null;
  }
  const escaped = escapeHtml(text);
  switch (block.type) {
    case "heading_1":
      return `<h1>${escaped}</h1>`;
    case "heading_2":
      return `<h2>${escaped}</h2>`;
    case "heading_3":
      return `<h3>${escaped}</h3>`;
    case "bulleted_list_item":
      return `<ul><li>${escaped}</li></ul>`;
    case "numbered_list_item":
      return `<ol><li>${escaped}</li></ol>`;
    case "quote":
      return `<blockquote>${escaped}</blockquote>`;
    case "code":
      return `<pre><code>${escaped}</code></pre>`;
    case "to_do":
      return `<p>☐ ${escaped}</p>`;
    case "divider":
      return "<hr/>";
    default:
      return `<p>${escaped}</p>`;
  }
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(accessToken), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Notion ${init?.method ?? "GET"} ${url} ${response.status}: ${body.slice(
        0,
        200
      )}`
    );
  }
  return (await response.json()) as T;
}

function extractTitle(page: NotionPage): string {
  if (!page.properties) {
    return "Untitled";
  }
  for (const prop of Object.values(page.properties)) {
    if (prop?.type === "title" && prop.title?.length) {
      const joined = prop.title.map((t) => t.plain_text ?? "").join("");
      if (joined.trim()) {
        return joined;
      }
    }
  }
  return "Untitled";
}

function extractBlockText(block: NotionBlock): string {
  const payload = block[block.type];
  if (
    payload &&
    typeof payload === "object" &&
    "rich_text" in payload &&
    Array.isArray(payload.rich_text)
  ) {
    return payload.rich_text.map((t) => t.plain_text ?? "").join("");
  }
  return "";
}

async function fetchPageContent(
  accessToken: string,
  pageId: string
): Promise<{ plaintext: string; html: string }> {
  // V1: top-level blocks only — no recursion. Cheap, covers the common case.
  const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
  try {
    const res = await notionFetch<NotionBlockChildrenResponse>(
      url,
      accessToken
    );
    const plaintextParts: string[] = [];
    const htmlParts: string[] = [];
    for (const block of res.results) {
      const text = extractBlockText(block);
      if (text.length > 0) {
        plaintextParts.push(text);
      }
      const html = blockToHtml(block, text);
      if (html) {
        htmlParts.push(html);
      }
    }
    return {
      plaintext: plaintextParts.join("\n\n"),
      html: htmlParts.join(""),
    };
  } catch (err) {
    console.warn(`[notion] block fetch failed for page ${pageId}`, err);
    return { plaintext: "", html: "" };
  }
}

async function searchPages(
  accessToken: string,
  startCursor: string | undefined,
  sortDescending: boolean
): Promise<NotionSearchResponse> {
  const body: Record<string, unknown> = {
    filter: { property: "object", value: "page" },
    page_size: SEARCH_PAGE_SIZE,
    sort: {
      timestamp: "last_edited_time",
      direction: sortDescending ? "descending" : "ascending",
    },
  };
  if (startCursor) {
    body.start_cursor = startCursor;
  }
  return notionFetch<NotionSearchResponse>(
    "https://api.notion.com/v1/search",
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
}

async function* iterateBatches(
  ctx: SyncContext,
  options: { sortDescending: boolean; stopAfterTimestamp?: string }
): AsyncIterable<SyncBatch> {
  let cursor: string | undefined;
  // Track the highest last_edited_time seen across the whole iteration so we
  // can emit it as the new sync cursor when we're done.
  let maxSeen = options.stopAfterTimestamp;
  while (true) {
    const res = await searchPages(
      ctx.accessToken,
      cursor,
      options.sortDescending
    );
    const liveResults = res.results.filter((p) => !(p.archived || p.in_trash));

    // Delta mode: stop once we cross the previous high-water mark.
    let stop = false;
    let trimmed = liveResults;
    if (options.stopAfterTimestamp) {
      const idx = liveResults.findIndex(
        (p) => p.last_edited_time <= options.stopAfterTimestamp!
      );
      if (idx !== -1) {
        trimmed = liveResults.slice(0, idx);
        stop = true;
      }
    }

    for (const page of trimmed) {
      if (!maxSeen || page.last_edited_time > maxSeen) {
        maxSeen = page.last_edited_time;
      }
    }

    const items: NotionItem[] = await Promise.all(
      trimmed.map(async (page) => {
        const content = await fetchPageContent(ctx.accessToken, page.id);
        return { page, plaintext: content.plaintext, html: content.html };
      })
    );

    const done = stop || !(res.has_more && res.next_cursor);
    yield {
      items,
      // Only checkpoint the cursor when we finish; intermediate batches keep
      // the previous value so a crash mid-iteration won't advance past
      // un-ingested pages.
      cursor: done ? maxSeen : undefined,
      done,
    };
    if (done) {
      return;
    }
    cursor = res.next_cursor ?? undefined;
  }
}

interface NotionWebhookPayload {
  data?: { id?: string };
  entity?: { id?: string; type?: string };
  id?: string; // Notion event id
  type?: string; // e.g. "page.content_updated", "page.deleted"
  workspace_id?: string; // identifies the source workspace; used for connection lookup
  verification_token?: string; // present in the one-time verification request
}

async function verifyHmac(
  body: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }
  // Notion sends "sha256=<hex>"
  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time compare (best effort in JS).
  if (hex.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < hex.length; i += 1) {
    mismatch |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

const notionSync: ProviderSync = {
  kind: "hybrid",

  pollDelta(ctx) {
    return iterateBatches(ctx, {
      sortDescending: true,
      stopAfterTimestamp: ctx.cursor,
    });
  },

  async parseWebhook(req): Promise<WebhookParseResult | null> {
    const body = await req.text();
    let payload: NotionWebhookPayload;
    try {
      payload = JSON.parse(body) as NotionWebhookPayload;
    } catch {
      return null;
    }

    // One-time verification: Notion POSTs { verification_token } when a
    // webhook URL is first added in their UI. We don't gate on the absence of
    // a signature header — Notion has historically toggled whether they send
    // one on the verification request — so the presence of the token alone is
    // the discriminator.
    if (payload.verification_token) {
      return {
        kind: "verification",
        verificationToken: payload.verification_token,
      };
    }

    const secret = process.env.NOTION_WEBHOOK_TOKEN;
    if (!secret) {
      console.warn(
        "[notion] webhook delivery received but NOTION_WEBHOOK_TOKEN is not configured"
      );
      return null;
    }
    const ok = await verifyHmac(
      body,
      req.headers.get("X-Notion-Signature"),
      secret
    );
    if (!ok) {
      return null;
    }

    if (!payload.workspace_id) {
      // No way to route the event without a workspace id; treat as bad request.
      return { kind: "events", events: [] };
    }

    const externalId = payload.entity?.id ?? payload.data?.id;
    if (!externalId) {
      return { kind: "events", events: [] };
    }

    const eventId = payload.id ?? `${externalId}:${Date.now()}`;
    const isDelete = payload.type?.includes("deleted") ?? false;
    const event: WebhookEvent = {
      kind: isDelete ? "delete" : "upsert",
      externalId,
      eventId,
      connectionLookupKey: payload.workspace_id,
    };
    return { kind: "events", events: [event] };
  },

  async fetchOne(ctx, externalId) {
    try {
      const page = await notionFetch<NotionPage>(
        `https://api.notion.com/v1/pages/${externalId}`,
        ctx.accessToken
      );
      const content = await fetchPageContent(ctx.accessToken, page.id);
      return {
        page,
        plaintext: content.plaintext,
        html: content.html,
      } satisfies NotionItem;
    } catch {
      return null;
    }
  },

  toResource(rawItem): ResourceUpsert {
    const item = rawItem as NotionItem;
    return {
      externalId: item.page.id,
      externalUrl: item.page.url,
      type: "note",
      title: extractTitle(item.page),
      note: {
        plainTextContent: item.plaintext,
        htmlContent: item.html,
      },
    };
  },
};

export const notion: OAuth2ProviderDescriptor = {
  id: "notion",
  label: "Notion",
  authType: "oauth2",
  authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
  scopes: [],
  clientId: process.env.NOTION_CLIENT_ID,
  clientSecret: process.env.NOTION_CLIENT_SECRET,
  authorizeExtraParams: {
    owner: "user",
    response_type: "code",
  },
  tokenAuthStyle: "header",
  fetchAccountInfo: async (accessToken, rawTokenResponse) => {
    // Notion includes workspace_id in the OAuth token response. We use that as
    // providerAccountId so webhook payloads (which carry workspace_id) can be
    // routed back to the correct connection row.
    const workspaceIdFromToken =
      typeof rawTokenResponse?.workspace_id === "string"
        ? (rawTokenResponse.workspace_id as string)
        : undefined;
    const workspaceNameFromToken =
      typeof rawTokenResponse?.workspace_name === "string"
        ? (rawTokenResponse.workspace_name as string)
        : undefined;

    const me = await notionFetch<NotionBotUser>(
      "https://api.notion.com/v1/users/me",
      accessToken
    );
    const ownerEmail = me.bot?.owner?.user?.person?.email;
    const ownerName = me.bot?.owner?.user?.name;
    const label =
      workspaceNameFromToken ??
      me.bot?.workspace_name ??
      ownerEmail ??
      ownerName ??
      me.name ??
      "Notion workspace";
    return {
      providerAccountId: workspaceIdFromToken ?? me.id,
      providerAccountLabel: label,
    };
  },
  sync: notionSync,
};

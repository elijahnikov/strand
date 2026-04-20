import type { ImportParser, ImportRecord, ImportYield } from "./types";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";
const SEARCH_PAGE_SIZE = 100;
const BLOCK_PAGE_SIZE = 100;
const RATE_LIMIT_MS = 350;
const BACKOFF_MS = 5000;
const MAX_RETRIES = 3;
const MAX_DEPTH = 3;

const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;

interface RichText {
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
  href?: string | null;
  plain_text?: string;
}

interface NotionParent {
  database_id?: string;
  page_id?: string;
  type?: string;
  workspace?: boolean;
}

interface NotionPage {
  archived?: boolean;
  created_time?: string;
  id: string;
  last_edited_time?: string;
  object: "page";
  parent?: NotionParent;
  properties?: Record<
    string,
    { type?: string; title?: RichText[]; rich_text?: RichText[] }
  >;
  url?: string;
}

interface SearchResponse {
  has_more: boolean;
  next_cursor: string | null;
  results: NotionPage[];
}

interface NotionBlock {
  bulleted_list_item?: { rich_text?: RichText[] };
  callout?: { rich_text?: RichText[] };
  code?: { rich_text?: RichText[]; language?: string };
  divider?: Record<string, never>;
  has_children?: boolean;
  heading_1?: { rich_text?: RichText[] };
  heading_2?: { rich_text?: RichText[] };
  heading_3?: { rich_text?: RichText[] };
  id: string;
  numbered_list_item?: { rich_text?: RichText[] };
  paragraph?: { rich_text?: RichText[] };
  quote?: { rich_text?: RichText[] };
  to_do?: { rich_text?: RichText[]; checked?: boolean };
  toggle?: { rich_text?: RichText[] };
  type: string;
  [key: string]: unknown;
}

interface BlockChildrenResponse {
  has_more: boolean;
  next_cursor: string | null;
  results: NotionBlock[];
}

export const parseNotionApi: ImportParser = {
  kind: "token",
  source: "notion_oauth",
  async *parse({ token }): AsyncIterable<ImportYield> {
    let cursor: string | null = null;
    do {
      const response = await searchPages(token, cursor);
      if (!response) {
        yield {
          __error: "Failed to fetch Notion pages",
          item: "notion_api",
        };
        return;
      }
      for (const page of response.results) {
        if (page.archived) {
          continue;
        }
        try {
          const record = await buildPageRecord(token, page);
          yield record;
        } catch (error) {
          yield {
            __error: error instanceof Error ? error.message : String(error),
            item: page.id,
          };
        }
      }
      cursor = response.has_more ? response.next_cursor : null;
    } while (cursor);
  },
};

async function searchPages(
  token: string,
  cursor: string | null
): Promise<SearchResponse | null> {
  const body: Record<string, unknown> = {
    filter: { property: "object", value: "page" },
    page_size: SEARCH_PAGE_SIZE,
  };
  if (cursor) {
    body.start_cursor = cursor;
  }
  return await notionFetch<SearchResponse>(token, "/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function buildPageRecord(
  token: string,
  page: NotionPage
): Promise<ImportRecord> {
  const title = extractTitle(page);
  const blocks = await fetchBlockChildren(token, page.id, 0);
  const html = blocksToHtml(blocks);
  const plainText = blocksToPlainText(blocks);
  const collectionPath = derivePath(page);
  const createdAt = page.created_time
    ? Date.parse(page.created_time)
    : undefined;
  const updatedAt = page.last_edited_time
    ? Date.parse(page.last_edited_time)
    : undefined;

  return {
    sourceItemId: `notion:${page.id}`,
    type: "note",
    title: title || "Untitled",
    url: page.url,
    htmlContent: html,
    plainTextContent: plainText,
    collectionPath,
    createdAt: Number.isNaN(createdAt) ? undefined : createdAt,
    updatedAt: Number.isNaN(updatedAt) ? undefined : updatedAt,
  };
}

function extractTitle(page: NotionPage): string {
  if (!page.properties) {
    return "";
  }
  for (const value of Object.values(page.properties)) {
    if (value.type === "title" && value.title) {
      return richTextToPlain(value.title);
    }
  }
  return "";
}

function derivePath(page: NotionPage): string[] | undefined {
  const parent = page.parent;
  if (!parent) {
    return;
  }
  if (parent.type === "workspace") {
    return;
  }
  if (parent.type === "database_id") {
    return ["Database"];
  }
  if (parent.type === "page_id") {
    return ["Pages"];
  }
  return;
}

async function fetchBlockChildren(
  token: string,
  blockId: string,
  depth: number
): Promise<NotionBlock[]> {
  if (depth >= MAX_DEPTH) {
    return [];
  }
  const out: NotionBlock[] = [];
  let cursor: string | null = null;
  do {
    const qs = new URLSearchParams({ page_size: String(BLOCK_PAGE_SIZE) });
    if (cursor) {
      qs.set("start_cursor", cursor);
    }
    const response = await notionFetch<BlockChildrenResponse>(
      token,
      `/blocks/${blockId}/children?${qs.toString()}`,
      { method: "GET" }
    );
    if (!response) {
      break;
    }
    for (const block of response.results) {
      if (block.has_children) {
        const children = await fetchBlockChildren(token, block.id, depth + 1);
        block.children = children;
      }
      out.push(block);
    }
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return out;
}

function blocksToHtml(blocks: NotionBlock[]): string {
  return blocks.map((b) => renderBlock(b)).join("\n");
}

function renderBlock(block: NotionBlock): string {
  const children = Array.isArray(block.children)
    ? (block.children as NotionBlock[])
    : [];
  const childHtml = children.length > 0 ? blocksToHtml(children) : "";
  switch (block.type) {
    case "paragraph":
      return wrap("p", richTextToHtml(block.paragraph?.rich_text)) + childHtml;
    case "heading_1":
      return wrap("h1", richTextToHtml(block.heading_1?.rich_text));
    case "heading_2":
      return wrap("h2", richTextToHtml(block.heading_2?.rich_text));
    case "heading_3":
      return wrap("h3", richTextToHtml(block.heading_3?.rich_text));
    case "bulleted_list_item":
      return `<ul><li>${richTextToHtml(block.bulleted_list_item?.rich_text)}${childHtml}</li></ul>`;
    case "numbered_list_item":
      return `<ol><li>${richTextToHtml(block.numbered_list_item?.rich_text)}${childHtml}</li></ol>`;
    case "to_do": {
      const checked = block.to_do?.checked ? "checked" : "";
      return `<p><input type="checkbox" disabled ${checked}/> ${richTextToHtml(block.to_do?.rich_text)}</p>${childHtml}`;
    }
    case "quote":
      return `<blockquote>${richTextToHtml(block.quote?.rich_text)}${childHtml}</blockquote>`;
    case "callout":
      return `<blockquote>${richTextToHtml(block.callout?.rich_text)}${childHtml}</blockquote>`;
    case "code":
      return `<pre><code>${escapeHtml(richTextToPlain(block.code?.rich_text))}</code></pre>`;
    case "toggle":
      return `<details><summary>${richTextToHtml(block.toggle?.rich_text)}</summary>${childHtml}</details>`;
    case "divider":
      return "<hr/>";
    default:
      return childHtml;
  }
}

function blocksToPlainText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const text = extractBlockText(block);
    if (text) {
      lines.push(text);
    }
    const children = Array.isArray(block.children)
      ? (block.children as NotionBlock[])
      : [];
    if (children.length > 0) {
      const sub = blocksToPlainText(children);
      if (sub) {
        lines.push(sub);
      }
    }
  }
  return lines.join("\n");
}

function extractBlockText(block: NotionBlock): string {
  const rt =
    block.paragraph?.rich_text ??
    block.heading_1?.rich_text ??
    block.heading_2?.rich_text ??
    block.heading_3?.rich_text ??
    block.bulleted_list_item?.rich_text ??
    block.numbered_list_item?.rich_text ??
    block.to_do?.rich_text ??
    block.quote?.rich_text ??
    block.callout?.rich_text ??
    block.code?.rich_text ??
    block.toggle?.rich_text;
  return richTextToPlain(rt);
}

function richTextToPlain(rt: RichText[] | undefined): string {
  if (!rt) {
    return "";
  }
  return rt.map((r) => r.plain_text ?? "").join("");
}

function richTextToHtml(rt: RichText[] | undefined): string {
  if (!rt) {
    return "";
  }
  return rt.map((r) => renderRichText(r)).join("");
}

function renderRichText(r: RichText): string {
  let text = escapeHtml(r.plain_text ?? "");
  const ann = r.annotations;
  if (ann?.code) {
    text = `<code>${text}</code>`;
  }
  if (ann?.bold) {
    text = `<strong>${text}</strong>`;
  }
  if (ann?.italic) {
    text = `<em>${text}</em>`;
  }
  if (ann?.strikethrough) {
    text = `<s>${text}</s>`;
  }
  if (ann?.underline) {
    text = `<u>${text}</u>`;
  }
  if (r.href) {
    text = `<a href="${escapeHtml(r.href)}">${text}</a>`;
  }
  return text;
}

function wrap(tag: string, inner: string): string {
  if (!inner) {
    return "";
  }
  return `<${tag}>${inner}</${tag}>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(AMP_RE, "&amp;")
    .replace(LT_RE, "&lt;")
    .replace(GT_RE, "&gt;");
}

async function notionFetch<T>(
  token: string,
  path: string,
  init: { method: "GET" | "POST"; body?: string }
): Promise<T | null> {
  const url = `${NOTION_BASE}${path}`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await sleep(RATE_LIMIT_MS);
    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body,
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) {
      await sleep(BACKOFF_MS);
      continue;
    }
    return null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import type { ImportParser, ImportYield } from "./types";

const READWISE_EXPORT_URL = "https://readwise.io/api/v2/export/";
const RATE_LIMIT_BACKOFF_MS = 5000;
const MAX_RETRIES = 3;

interface Highlight {
  highlighted_at?: string;
  id: number;
  location?: number;
  location_type?: string;
  note?: string;
  tags?: Array<{ id: number; name: string }>;
  text: string;
  url?: string;
}

interface Book {
  author?: string;
  book_tags?: Array<{ id: number; name: string }>;
  category?: string;
  cover_image_url?: string;
  highlights: Highlight[];
  source?: string;
  source_url?: string;
  title: string;
  unique_url?: string;
  user_book_id: number;
}

interface ExportResponse {
  count: number;
  nextPageCursor: string | null;
  results: Book[];
}

export const parseReadwise: ImportParser = {
  kind: "token",
  source: "readwise_api",
  async *parse({ token }): AsyncIterable<ImportYield> {
    let cursor: string | null = null;
    do {
      const response = await fetchPage(token, cursor);
      if (!response) {
        yield {
          __error: "Failed to fetch Readwise export",
          item: "readwise_api",
        };
        return;
      }
      for (const book of response.results) {
        yield buildRecord(book);
      }
      cursor = response.nextPageCursor;
    } while (cursor);
  },
};

async function fetchPage(
  token: string,
  cursor: string | null
): Promise<ExportResponse | null> {
  const url = cursor
    ? `${READWISE_EXPORT_URL}?pageCursor=${encodeURIComponent(cursor)}`
    : READWISE_EXPORT_URL;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });
    if (res.ok) {
      return (await res.json()) as ExportResponse;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_BACKOFF_MS;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) {
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
    return null;
  }
  return null;
}

function buildRecord(book: Book) {
  const tags = new Set<string>();
  for (const t of book.book_tags ?? []) {
    if (t.name) {
      tags.add(t.name.toLowerCase());
    }
  }
  for (const h of book.highlights ?? []) {
    for (const t of h.tags ?? []) {
      if (t.name) {
        tags.add(t.name.toLowerCase());
      }
    }
  }

  const markdown = renderMarkdown(book);
  const html = renderHtml(book);

  return {
    sourceItemId: `readwise:${book.user_book_id}`,
    type: "note" as const,
    title: book.title || "Untitled",
    description: book.author ? `by ${book.author}` : undefined,
    url: book.source_url ?? book.unique_url,
    plainTextContent: markdown,
    htmlContent: html,
    tagNames: tags.size > 0 ? Array.from(tags) : undefined,
    collectionPath: book.category ? [capitalize(book.category)] : undefined,
  };
}

function renderMarkdown(book: Book): string {
  const lines: string[] = [];
  lines.push(`# ${book.title}`);
  if (book.author) {
    lines.push(`*by ${book.author}*`);
  }
  if (book.source_url) {
    lines.push(`Source: ${book.source_url}`);
  }
  lines.push("");
  for (const h of book.highlights ?? []) {
    lines.push(`> ${h.text.replace(/\n+/g, " ")}`);
    if (h.note) {
      lines.push("");
      lines.push(h.note);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderHtml(book: Book): string {
  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(book.title)}</h1>`);
  if (book.author) {
    parts.push(`<p><em>by ${escapeHtml(book.author)}</em></p>`);
  }
  if (book.source_url) {
    parts.push(
      `<p>Source: <a href="${escapeHtml(book.source_url)}">${escapeHtml(
        book.source_url
      )}</a></p>`
    );
  }
  for (const h of book.highlights ?? []) {
    parts.push(`<blockquote>${escapeHtml(h.text)}</blockquote>`);
    if (h.note) {
      parts.push(`<p>${escapeHtml(h.note)}</p>`);
    }
  }
  return parts.join("\n");
}

const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const QUOT_RE = /"/g;

function escapeHtml(s: string): string {
  return s
    .replace(AMP_RE, "&amp;")
    .replace(LT_RE, "&lt;")
    .replace(GT_RE, "&gt;")
    .replace(QUOT_RE, "&quot;");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

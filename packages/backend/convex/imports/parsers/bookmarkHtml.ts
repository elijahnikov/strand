import type { ImportParser, ImportYield } from "./types";
import { hashString } from "./util";

const TAG_RE = /<(\/?)([A-Za-z0-9]+)([^>]*)>/g;
const ATTR_RE = /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g;
const TAG_DELIM_RE = /[,;]/;
const AMP_ENTITY_RE = /&amp;/g;
const LT_ENTITY_RE = /&lt;/g;
const GT_ENTITY_RE = /&gt;/g;
const QUOT_ENTITY_RE = /&quot;/g;
const APOS_ENTITY_RE = /&#39;/g;
const NBSP_ENTITY_RE = /&nbsp;/g;

export const parseBookmarkHtml: ImportParser = {
  kind: "file",
  source: "bookmark_html",
  async *parse({ blob }): AsyncIterable<ImportYield> {
    const text = await blob.text();
    const path: string[] = [];
    let pendingFolderName: string | undefined;

    TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null = TAG_RE.exec(text);
    let lastIndex = 0;

    while (match !== null) {
      const [, closing, tagNameRaw, attrs] = match;
      const tagName = tagNameRaw?.toLowerCase();

      if (!closing && tagName === "h3") {
        const inner = extractInner(text, TAG_RE.lastIndex, "h3");
        pendingFolderName = decodeHtml(inner).trim();
      } else if (!closing && tagName === "dl") {
        if (pendingFolderName !== undefined) {
          path.push(pendingFolderName);
          pendingFolderName = undefined;
        }
      } else if (closing && tagName === "dl") {
        path.pop();
      } else if (!closing && tagName === "a") {
        const attrMap = parseAttrs(attrs ?? "");
        const href = attrMap.href;
        if (href) {
          const inner = extractInner(text, TAG_RE.lastIndex, "a");
          const title = decodeHtml(inner).trim() || href;
          const addDate = attrMap.add_date ?? attrMap.time_added;
          const createdAt = parseEpoch(addDate);
          const tagsRaw = attrMap.tags;
          const tagNames = tagsRaw
            ? tagsRaw
                .split(TAG_DELIM_RE)
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined;

          yield {
            sourceItemId: hashString(href),
            type: "website",
            title,
            url: href,
            collectionPath: path.length > 0 ? [...path] : undefined,
            tagNames,
            createdAt,
          };
        }
      }

      lastIndex = TAG_RE.lastIndex;
      match = TAG_RE.exec(text);
      if (match && match.index < lastIndex) {
        break;
      }
    }
  },
};

const CLOSE_H3_RE = /<\/h3\s*>/i;
const CLOSE_A_RE = /<\/a\s*>/i;

function extractInner(text: string, start: number, tagName: string): string {
  const closeRe = tagName === "h3" ? CLOSE_H3_RE : CLOSE_A_RE;
  const slice = text.slice(start);
  const endMatch = slice.match(closeRe);
  if (!endMatch || endMatch.index === undefined) {
    return "";
  }
  return slice.slice(0, endMatch.index);
}

function parseAttrs(attrs: string): Record<string, string> {
  const result: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null = ATTR_RE.exec(attrs);
  while (m !== null) {
    const key = m[1]?.toLowerCase();
    const value = m[2];
    if (key && value !== undefined) {
      result[key] = value;
    }
    m = ATTR_RE.exec(attrs);
  }
  return result;
}

function parseEpoch(raw: string | undefined): number | undefined {
  if (!raw) {
    return;
  }
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) {
    return;
  }
  return n > 1e12 ? n : n * 1000;
}

function decodeHtml(s: string): string {
  return s
    .replace(AMP_ENTITY_RE, "&")
    .replace(LT_ENTITY_RE, "<")
    .replace(GT_ENTITY_RE, ">")
    .replace(QUOT_ENTITY_RE, '"')
    .replace(APOS_ENTITY_RE, "'")
    .replace(NBSP_ENTITY_RE, " ");
}

import { unzipSync } from "fflate";
import type { ImportParser, ImportRecord, ImportYield } from "./types";
import { hashString } from "./util";

const ROOT_DIR_RE = /^[^/]+\//;
const HTML_EXT_RE = /\.html?$/i;
const BOOKMARKS_FILE_RE = /(?:^|\/)Bookmarks\.html$/i;
const CREATED_AT_RE = /\bdata-created-at="([^"]+)"/;
const TAG_RE = /<(\/?)([A-Za-z0-9]+)([^>]*)>/g;
const ATTR_RE = /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g;
const TAG_DELIM_RE = /[,;]/;
const AMP_ENTITY_RE = /&amp;/g;
const LT_ENTITY_RE = /&lt;/g;
const GT_ENTITY_RE = /&gt;/g;
const QUOT_ENTITY_RE = /&quot;/g;
const APOS_ENTITY_RE = /&#39;/g;
const NBSP_ENTITY_RE = /&nbsp;/g;
const CLOSE_H3_RE = /<\/h3\s*>/i;
const CLOSE_A_RE = /<\/a\s*>/i;
const HTML_TAG_STRIP_RE = /<[^>]+>/g;
const WHITESPACE_COLLAPSE_RE = /\s+/g;
const UNDERSCORE_RE = /_/g;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  avif: "image/avif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  zip: "application/zip",
};

export const parseFabricZip: ImportParser = {
  kind: "file",
  source: "fabric",
  async *parse({ blob }): AsyncIterable<ImportYield> {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buffer);
    } catch (error) {
      yield {
        __error: error instanceof Error ? error.message : "Invalid zip",
        item: "archive",
      };
      return;
    }

    for (const [rawPath, bytes] of Object.entries(entries)) {
      if (rawPath.endsWith("/")) {
        continue;
      }
      const rel = rawPath.replace(ROOT_DIR_RE, "");
      if (!rel) {
        continue;
      }

      if (BOOKMARKS_FILE_RE.test(rel)) {
        const text = new TextDecoder("utf-8").decode(bytes);
        yield* parseBookmarksHtml(text);
        continue;
      }

      if (HTML_EXT_RE.test(rel)) {
        const text = new TextDecoder("utf-8").decode(bytes);
        yield buildNoteRecord(rel, text);
        continue;
      }

      yield buildFileRecord(rel, bytes);
    }
  },
};

function buildNoteRecord(rel: string, html: string): ImportRecord {
  const segments = rel.split("/");
  const fileName = segments.at(-1) ?? rel;
  const titleFromFile = humanize(fileName.replace(HTML_EXT_RE, ""));
  const collectionPath =
    segments.length > 1 ? segments.slice(0, -1).filter(Boolean) : undefined;

  const plainText = stripHtml(html);
  const createdAt = extractCreatedAt(html);

  return {
    sourceItemId: hashString(`fabric:note:${rel}`),
    type: "note",
    title: titleFromFile || "Untitled",
    htmlContent: html,
    plainTextContent: plainText,
    collectionPath,
    createdAt,
  };
}

function buildFileRecord(rel: string, bytes: Uint8Array): ImportRecord {
  const segments = rel.split("/");
  const fileName = segments.at(-1) ?? rel;
  const collectionPath =
    segments.length > 1 ? segments.slice(0, -1).filter(Boolean) : undefined;
  const extIdx = fileName.lastIndexOf(".");
  const ext = extIdx >= 0 ? fileName.slice(extIdx + 1).toLowerCase() : "";
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const titleBase = extIdx >= 0 ? fileName.slice(0, extIdx) : fileName;

  return {
    sourceItemId: hashString(`fabric:file:${rel}`),
    type: "file",
    title: humanize(titleBase) || fileName,
    collectionPath,
    attachment: {
      bytes,
      fileName,
      mimeType,
    },
  };
}

function extractCreatedAt(html: string): number | undefined {
  const match = html.match(CREATED_AT_RE);
  if (!match?.[1]) {
    return;
  }
  const ts = Date.parse(match[1]);
  return Number.isNaN(ts) ? undefined : ts;
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(HTML_TAG_STRIP_RE, " "))
    .replace(WHITESPACE_COLLAPSE_RE, " ")
    .trim();
}

function humanize(raw: string): string {
  return raw.replace(UNDERSCORE_RE, " ").trim();
}

function* parseBookmarksHtml(text: string): Iterable<ImportYield> {
  const path: string[] = [];
  let pendingFolderName: string | undefined;
  let rootSkipped = false;

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
        if (!rootSkipped && pendingFolderName === "Fabric Bookmarks") {
          rootSkipped = true;
        } else {
          path.push(pendingFolderName);
        }
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
          sourceItemId: hashString(`fabric:bookmark:${href}`),
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
}

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

import { unzipSync } from "fflate";
import type { ImportParser, ImportRecord, ImportYield } from "./types";
import { hashString } from "./util";
import { markdownToHtml } from "./util/markdownToHtml";

const MARKDOWN_EXT_RE = /\.(md|markdown)$/i;
const FRONTMATTER_SPLIT_RE = /\r?\n/;
const LEADING_NEWLINE_RE = /^\r?\n/;
const LIST_ITEM_RE = /^\s*-\s*(.+?)\s*$/;
const KV_RE = /^([^:\s]+)\s*:\s*(.*)$/;
const HEADING_RE = /^#\s+(.+)$/m;
const TAG_SPLIT_RE = /[, ]/;
const INLINE_TAG_RE = /(?:^|\s)#([a-z0-9_\-/]+)/gi;
const ROOT_DIR_RE = /^[^/]+\//;
const LEADING_HASH_RE = /^#/;

export const parseMarkdownZip: ImportParser = {
  kind: "file",
  source: "markdown_zip",
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

    const decoder = new TextDecoder("utf-8");

    for (const [path, bytes] of Object.entries(entries)) {
      if (!isMarkdownFile(path)) {
        continue;
      }
      if (path.endsWith("/")) {
        continue;
      }
      if (shouldSkipPath(path)) {
        continue;
      }

      const content = decoder.decode(bytes);
      const record = parseMarkdownFile(path, content);
      if (record) {
        yield record;
      }
    }
  },
};

function isMarkdownFile(path: string): boolean {
  return MARKDOWN_EXT_RE.test(path);
}

function shouldSkipPath(path: string): boolean {
  const segments = path.split("/");
  return segments.some(
    (s) => s === ".obsidian" || s === ".trash" || s === "node_modules"
  );
}

function parseMarkdownFile(path: string, content: string): ImportRecord | null {
  const { frontmatter, body } = splitFrontmatter(content);
  const rel = path.replace(ROOT_DIR_RE, "");
  const fileName = rel.split("/").pop() ?? rel;
  const titleFromFile = fileName.replace(MARKDOWN_EXT_RE, "");

  const title =
    (frontmatter.title as string | undefined)?.trim() ||
    firstHeading(body) ||
    titleFromFile;

  const tagNames = collectTags(frontmatter, body);
  const collectionPath = rel.includes("/")
    ? rel.split("/").slice(0, -1)
    : undefined;

  const createdAt =
    parseFrontmatterDate(frontmatter.created) ??
    parseFrontmatterDate(frontmatter.date);

  const html = markdownToHtml(body);

  return {
    sourceItemId: hashString(path),
    type: "note",
    title,
    plainTextContent: body,
    htmlContent: html,
    collectionPath,
    tagNames: tagNames.length > 0 ? tagNames : undefined,
    createdAt,
  };
}

function splitFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: {}, body: content };
  }
  const yaml = content.slice(3, end).trim();
  const body = content.slice(end + 4).replace(LEADING_NEWLINE_RE, "");
  return { frontmatter: parseSimpleYaml(yaml), body };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split(FRONTMATTER_SPLIT_RE);
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    const listMatch = line.match(LIST_ITEM_RE);
    if (listMatch && currentKey && currentList) {
      currentList.push(stripQuotes(listMatch[1] ?? ""));
      continue;
    }
    const kvMatch = line.match(KV_RE);
    if (kvMatch) {
      const [, key, raw] = kvMatch;
      if (!key) {
        continue;
      }
      currentKey = key;
      currentList = null;
      const value = raw?.trim() ?? "";
      if (value === "") {
        const list: string[] = [];
        currentList = list;
        result[key] = list;
      } else if (value.startsWith("[") && value.endsWith("]")) {
        result[key] = value
          .slice(1, -1)
          .split(",")
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean);
      } else {
        result[key] = stripQuotes(value);
      }
    }
  }
  return result;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function firstHeading(body: string): string | undefined {
  const match = body.match(HEADING_RE);
  return match?.[1]?.trim();
}

function collectTags(
  frontmatter: Record<string, unknown>,
  body: string
): string[] {
  const tags = new Set<string>();
  const fm = frontmatter.tags ?? frontmatter.tag;
  if (Array.isArray(fm)) {
    for (const t of fm) {
      if (typeof t === "string" && t.trim()) {
        tags.add(t.trim().toLowerCase());
      }
    }
  } else if (typeof fm === "string" && fm.trim()) {
    for (const t of fm.split(TAG_SPLIT_RE)) {
      if (t.trim()) {
        tags.add(t.trim().toLowerCase());
      }
    }
  }
  const inline = body.match(INLINE_TAG_RE) ?? [];
  for (const m of inline) {
    const t = m.trim().replace(LEADING_HASH_RE, "").toLowerCase();
    if (t) {
      tags.add(t);
    }
  }
  return Array.from(tags);
}

function parseFrontmatterDate(raw: unknown): number | undefined {
  if (typeof raw !== "string") {
    return;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

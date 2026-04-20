import { unzipSync } from "fflate";
import type { ImportParser, ImportRecord, ImportYield } from "./types";
import { hashString } from "./util";
import { markdownToHtml } from "./util/markdownToHtml";

const UUID_SUFFIX_RE =
  / [0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i;
const UUID_HEX_SUFFIX_RE = / [0-9a-f]{32}/i;
const MARKDOWN_EXT_RE = /\.md$/i;
const CSV_EXT_RE = /\.csv$/i;
const HEADING_RE = /^#\s+(.+)$/m;
const ROOT_DIR_RE = /^[^/]+\//;

export const parseNotionZip: ImportParser = {
  kind: "file",
  source: "notion_zip",
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
      if (path.endsWith("/")) {
        continue;
      }
      const content = decoder.decode(bytes);

      if (MARKDOWN_EXT_RE.test(path)) {
        const record = parseMarkdownPage(path, content);
        if (record) {
          yield record;
        }
        continue;
      }

      if (CSV_EXT_RE.test(path)) {
        yield* parseDatabaseCsv(path, content);
      }
    }
  },
};

function stripUuid(s: string): string {
  return s.replace(UUID_SUFFIX_RE, "").replace(UUID_HEX_SUFFIX_RE, "");
}

function cleanPath(path: string): string {
  return path
    .split("/")
    .map((seg) => stripUuid(seg))
    .join("/");
}

function parseMarkdownPage(path: string, content: string): ImportRecord | null {
  const rel = cleanPath(path.replace(ROOT_DIR_RE, ""));
  const fileName = rel.split("/").pop() ?? rel;
  const titleFromFile = fileName.replace(MARKDOWN_EXT_RE, "");

  const title = firstHeading(content) || titleFromFile;
  const html = markdownToHtml(content);
  const collectionPath = rel.includes("/")
    ? rel.split("/").slice(0, -1).filter(Boolean)
    : undefined;

  return {
    sourceItemId: hashString(path),
    type: "note",
    title,
    plainTextContent: content,
    htmlContent: html,
    collectionPath,
  };
}

function* parseDatabaseCsv(
  path: string,
  content: string
): Iterable<ImportRecord> {
  const rows = parseCsv(content);
  if (rows.length < 2) {
    return;
  }
  const header = rows[0] ?? [];
  const cleanedDbPath = cleanPath(path.replace(ROOT_DIR_RE, ""));
  const dbName = (cleanedDbPath.split("/").pop() ?? "Database").replace(
    CSV_EXT_RE,
    ""
  );
  const parentPath = cleanedDbPath.includes("/")
    ? cleanedDbPath.split("/").slice(0, -1).filter(Boolean)
    : [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === "")) {
      continue;
    }
    const titleCell = row[0]?.trim() || `Row ${i}`;
    const sourceItemId = hashString(`${path}:${i}`);
    const bodyLines: string[] = [];
    for (let j = 1; j < header.length && j < row.length; j++) {
      const key = header[j]?.trim();
      const value = row[j]?.trim();
      if (key && value) {
        bodyLines.push(`**${key}:** ${value}`);
      }
    }
    const body = bodyLines.join("\n\n");
    yield {
      sourceItemId,
      type: "note",
      title: titleCell,
      plainTextContent: body,
      htmlContent: markdownToHtml(body),
      collectionPath: [...parentPath, dbName],
    };
  }
}

function firstHeading(body: string): string | undefined {
  const match = body.match(HEADING_RE);
  return match?.[1]?.trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

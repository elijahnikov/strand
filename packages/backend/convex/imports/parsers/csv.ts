import type { ImportParser, ImportRecord, ImportYield } from "./types";
import { hashString } from "./util";

const URL_KEYS = ["url", "link", "href"];
const TAG_DELIM_RE = /[|,;]/;
const TITLE_KEYS = ["title", "name"];
const TAG_KEYS = ["tags", "folder", "labels"];
const TIME_KEYS = ["time_added", "created_at", "created", "date", "timestamp"];
const ARCHIVED_KEYS = ["status", "folder"];
const NOTE_KEYS = ["note", "description", "highlight", "excerpt"];

export const parseUrlCsv: ImportParser = {
  kind: "file",
  source: "url_csv",
  async *parse({ blob }): AsyncIterable<ImportYield> {
    const text = await blob.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return;
    }
    const header = rows[0];
    if (!header) {
      return;
    }
    const headerIndex: Record<string, number> = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i]?.trim().toLowerCase();
      if (key) {
        headerIndex[key] = i;
      }
    }

    const getField = (row: string[], keys: string[]): string | undefined => {
      for (const key of keys) {
        const idx = headerIndex[key];
        if (idx !== undefined) {
          const v = row[idx];
          if (v !== undefined && v !== "") {
            return v;
          }
        }
      }
      return undefined;
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) {
        continue;
      }
      const url = getField(row, URL_KEYS);
      if (!url) {
        continue;
      }
      const title = getField(row, TITLE_KEYS) ?? url;
      const tagsRaw = getField(row, TAG_KEYS);
      const tagNames = tagsRaw
        ? tagsRaw
            .split(TAG_DELIM_RE)
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const timeRaw = getField(row, TIME_KEYS);
      const createdAt = parseTimestamp(timeRaw);
      const archivedRaw = getField(row, ARCHIVED_KEYS);
      const isArchived =
        archivedRaw?.toLowerCase() === "archive" ||
        archivedRaw?.toLowerCase() === "archived";
      const description = getField(row, NOTE_KEYS);

      const record: ImportRecord = {
        sourceItemId: hashString(url),
        type: "website",
        title,
        url,
        description,
        tagNames,
        createdAt,
        isArchived,
      };
      yield record;
    }
  },
};

function parseTimestamp(raw: string | undefined): number | undefined {
  if (!raw) {
    return;
  }
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && asNum > 0) {
    return asNum > 1e12 ? asNum : asNum * 1000;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
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

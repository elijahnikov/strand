import type { ImportParser, ImportRecord, ImportYield } from "./types";
import { hashString } from "./util";

const NOTE_OPEN = "<note>";
const NOTE_CLOSE = "</note>";
const TITLE_RE = /<title>([\s\S]*?)<\/title>/;
const CONTENT_RE = /<content>([\s\S]*?)<\/content>/;
const CREATED_RE = /<created>([\s\S]*?)<\/created>/;
const UPDATED_RE = /<updated>([\s\S]*?)<\/updated>/;
const TAG_RE = /<tag>([\s\S]*?)<\/tag>/g;
const SOURCE_URL_RE = /<source-url>([\s\S]*?)<\/source-url>/;
const CDATA_RE = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;
const EN_NOTE_OPEN_RE = /<en-note[^>]*>/;
const EN_NOTE_CLOSE_RE = /<\/en-note>/;
const EN_MEDIA_RE = /<en-media[^/>]*\/?>(?:<\/en-media>)?/g;
const EN_TODO_RE = /<en-todo[^>]*\/?>/g;
const AMP_ENTITY_RE = /&amp;/g;
const LT_ENTITY_RE = /&lt;/g;
const GT_ENTITY_RE = /&gt;/g;
const QUOT_ENTITY_RE = /&quot;/g;
const APOS_ENTITY_RE = /&#39;|&apos;/g;
const TAG_STRIP_RE = /<[^>]+>/g;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

export const parseEvernoteEnex: ImportParser = {
  kind: "file",
  source: "evernote_enex",
  async *parse({ blob }): AsyncIterable<ImportYield> {
    const text = await blob.text();
    let index = 0;
    let noteCount = 0;

    while (true) {
      const openIdx = text.indexOf(NOTE_OPEN, index);
      if (openIdx === -1) {
        break;
      }
      const closeIdx = text.indexOf(NOTE_CLOSE, openIdx);
      if (closeIdx === -1) {
        break;
      }
      const noteXml = text.slice(openIdx + NOTE_OPEN.length, closeIdx);
      const record = parseNote(noteXml, noteCount);
      if (record) {
        yield record;
      }
      noteCount++;
      index = closeIdx + NOTE_CLOSE.length;
    }
  },
};

function parseNote(xml: string, ordinal: number): ImportRecord | null {
  const title = extractCdata(xml.match(TITLE_RE)?.[1])?.trim() || "Untitled";
  const contentRaw = extractCdata(xml.match(CONTENT_RE)?.[1]) ?? "";
  const created = parseDate(xml.match(CREATED_RE)?.[1]);
  const updated = parseDate(xml.match(UPDATED_RE)?.[1]);
  const url = extractCdata(xml.match(SOURCE_URL_RE)?.[1])?.trim() || undefined;

  const tags: string[] = [];
  for (const m of xml.matchAll(TAG_RE)) {
    const tag = extractCdata(m[1])?.trim().toLowerCase();
    if (tag) {
      tags.push(tag);
    }
  }

  const { html, plain } = convertEnmlToHtml(contentRaw);
  const sourceItemId = hashString(`${title}:${created ?? ordinal}:${ordinal}`);

  return {
    sourceItemId,
    type: "note",
    title,
    plainTextContent: plain,
    htmlContent: html,
    url,
    createdAt: created,
    updatedAt: updated,
    tagNames: tags.length > 0 ? tags : undefined,
  };
}

function extractCdata(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return;
  }
  const match = raw.match(CDATA_RE);
  return match ? match[1] : raw;
}

function parseDate(raw: string | undefined): number | undefined {
  const s = extractCdata(raw)?.trim();
  if (!s) {
    return;
  }
  const iso =
    s.length === 16 && s.endsWith("Z") && !s.includes("-")
      ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
      : s;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function convertEnmlToHtml(enml: string): { html: string; plain: string } {
  let body = enml;
  const openMatch = body.match(EN_NOTE_OPEN_RE);
  if (openMatch && openMatch.index !== undefined) {
    body = body.slice(openMatch.index + openMatch[0].length);
  }
  const closeMatch = body.match(EN_NOTE_CLOSE_RE);
  if (closeMatch && closeMatch.index !== undefined) {
    body = body.slice(0, closeMatch.index);
  }
  body = body.replace(EN_MEDIA_RE, "").replace(EN_TODO_RE, "").trim();

  const plainText = decodeEntities(body.replace(TAG_STRIP_RE, " "))
    .replace(WHITESPACE_COLLAPSE_RE, " ")
    .trim();

  return { html: body, plain: plainText };
}

function decodeEntities(s: string): string {
  return s
    .replace(APOS_ENTITY_RE, "'")
    .replace(QUOT_ENTITY_RE, '"')
    .replace(LT_ENTITY_RE, "<")
    .replace(GT_ENTITY_RE, ">")
    .replace(AMP_ENTITY_RE, "&");
}

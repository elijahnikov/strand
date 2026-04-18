const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ESCAPE_RE = /[&<>"']/g;
const REGEXP_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const WHITESPACE_SPLIT_RE = /\s+/;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

export function escapeHtml(input: string): string {
  return input.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE[ch] ?? ch);
}

function escapeRegExp(input: string): string {
  return input.replace(REGEXP_ESCAPE_RE, "\\$&");
}

export function extractQueryTokens(query: string): string[] {
  const tokens = query
    .split(WHITESPACE_SPLIT_RE)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(tokens));
}

export function highlight(text: string, tokens: string[]): string {
  const escaped = escapeHtml(text);
  if (tokens.length === 0) {
    return escaped;
  }
  const pattern = tokens.map(escapeRegExp).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${pattern.join("|")})`, "gi");
  return escaped.replace(re, (match) => `<mark>${match}</mark>`);
}

const SNIPPET_WINDOW = 300;

export function buildSnippet(
  source: string | null | undefined,
  tokens: string[]
): string | null {
  if (!source) {
    return null;
  }
  const clean = source.replace(WHITESPACE_COLLAPSE_RE, " ").trim();
  if (!clean) {
    return null;
  }

  if (tokens.length === 0) {
    return highlight(clean.slice(0, SNIPPET_WINDOW), tokens);
  }

  const lowered = clean.toLowerCase();
  let firstHit = -1;
  for (const token of tokens) {
    const idx = lowered.indexOf(token.toLowerCase());
    if (idx !== -1 && (firstHit === -1 || idx < firstHit)) {
      firstHit = idx;
    }
  }

  if (firstHit === -1) {
    return highlight(clean.slice(0, SNIPPET_WINDOW), tokens);
  }

  const half = Math.floor(SNIPPET_WINDOW / 2);
  const start = Math.max(0, firstHit - half);
  const end = Math.min(clean.length, start + SNIPPET_WINDOW);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return prefix + highlight(clean.slice(start, end), tokens) + suffix;
}

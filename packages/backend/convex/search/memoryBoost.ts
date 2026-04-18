const BOOST_SECTION_HEADINGS = [
  "active projects",
  "recurring interests",
] as const;

const MAX_TERMS = 30;
const MIN_TERM_LENGTH = 3;

const LINE_SPLIT_RE = /\r?\n/;
const H2_RE = /^##\s+(.+)$/;
const BULLET_PREFIX_RE = /^([-*+•]\s+|\d+\.\s+)/;
const DELIMITER_RE = /[—–\-:]/;
const NON_ALNUM_RE = /[^a-z0-9\s]/g;
const WHITESPACE_SPLIT_RE = /\s+/;

const STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "into",
  "about",
  "this",
  "that",
  "their",
  "them",
  "they",
  "then",
  "than",
  "some",
  "such",
  "over",
  "under",
  "upon",
  "also",
  "while",
  "where",
  "when",
  "what",
  "been",
  "being",
  "have",
  "has",
  "had",
  "are",
  "was",
  "were",
  "our",
  "out",
  "its",
  "not",
  "but",
]);

export function extractBoostTerms(memory: string | null | undefined): string[] {
  if (!memory) {
    return [];
  }

  const lines = memory.split(LINE_SPLIT_RE);
  const terms = new Set<string>();
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const h2 = line.match(H2_RE);
    if (h2) {
      const heading = (h2[1] ?? "").trim().toLowerCase();
      inSection = BOOST_SECTION_HEADINGS.includes(
        heading as (typeof BOOST_SECTION_HEADINGS)[number]
      );
      continue;
    }

    if (!inSection) {
      continue;
    }

    const bullet = line.replace(BULLET_PREFIX_RE, "");
    const split = bullet.split(DELIMITER_RE)[0] ?? bullet;

    const tokens = split
      .toLowerCase()
      .replace(NON_ALNUM_RE, " ")
      .split(WHITESPACE_SPLIT_RE);

    for (const token of tokens) {
      if (token.length < MIN_TERM_LENGTH) {
        continue;
      }
      if (STOPWORDS.has(token)) {
        continue;
      }
      terms.add(token);
      if (terms.size >= MAX_TERMS) {
        return Array.from(terms);
      }
    }
  }

  return Array.from(terms);
}

export function matchesBoostTerms(
  name: string,
  boostTerms: readonly string[]
): boolean {
  if (boostTerms.length === 0) {
    return false;
  }
  const lower = name.toLowerCase();
  return boostTerms.some((term) => lower.includes(term));
}

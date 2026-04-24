/**
 * Deterministic mocks for the AI package. Test files use these together with
 * `vi.mock()` to replace OpenAI-backed implementations with stable fakes.
 *
 * Example:
 *   vi.mock("@omi/ai/embeddings", () => mockEmbeddingsModule());
 *   vi.mock("@omi/ai/providers", () => mockProvidersModule());
 */

const EMBEDDING_DIM = 1536;
const EMBEDDING_MODEL = "text-embedding-3-small";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: <>
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Produce a deterministic, normalized 1536-dim vector for a given string.
 * Two identical strings always produce the same vector; different strings
 * produce different vectors. The vector is L2-normalized so cosine similarity
 * against itself is ~1.0, which mirrors production embedding behavior for
 * workspace-isolation assertions.
 */
export function fakeEmbedding(text: string): number[] {
  const seed = hashString(text);
  const vec = new Array<number>(EMBEDDING_DIM);
  let squareSum = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Simple PRNG-ish deterministic sequence from seed + index.
    const x = Math.sin(seed * 9301 + i * 49_297) * 43_758.545;
    const v = x - Math.floor(x) - 0.5;
    vec[i] = v;
    squareSum += v * v;
  }
  const norm = Math.sqrt(squareSum) || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] = (vec[i] as number) / norm;
  }
  return vec;
}

export function mockProvidersModule() {
  return {
    createOpenAIProvider: (_apiKey: string) => ({}),
  };
}

export function mockEmbeddingsModule() {
  return {
    generateEmbedding: async (_provider: unknown, text: string) => ({
      embedding: fakeEmbedding(text),
      model: EMBEDDING_MODEL,
      tokens: Math.max(1, Math.ceil(text.length / 4)),
    }),
    generateEmbeddings: async (_provider: unknown, texts: string[]) => ({
      embeddings: texts.map((t) => fakeEmbedding(t)),
      model: EMBEDDING_MODEL,
      tokens: texts.reduce(
        (n, t) => n + Math.max(1, Math.ceil(t.length / 4)),
        0
      ),
    }),
  };
}

export interface MockEnrichmentResult {
  category: string;
  concepts?: Array<{ name: string; importance: number }>;
  extractedEntities: string[];
  keyQuotes: string[];
  language: string;
  sentiment: string;
  summary: string;
  tags: string[];
}

export function defaultEnrichmentResult(
  overrides: Partial<MockEnrichmentResult> = {}
): MockEnrichmentResult {
  return {
    summary: "A mock summary.",
    tags: ["mock-tag"],
    extractedEntities: [],
    sentiment: "neutral",
    language: "en",
    category: "general",
    keyQuotes: [],
    concepts: [],
    ...overrides,
  };
}

/**
 * Build a mock of `@omi/ai/enrichment`. The enricher returned from
 * `createEnricher` yields the `result` provided here. Callers can override
 * per-test by calling vi.doMock before importing handlers.
 */
export function mockEnrichmentModule(result: MockEnrichmentResult) {
  return {
    createEnricher: (_provider: unknown, _input: unknown) => ({
      enrich: async () => ({ result, tokens: 500, model: "gpt-4o-mini" }),
    }),
  };
}

/**
 * Build a mock of `@omi/ai/memory`. `extractMemory` returns `content`.
 * We keep `wordJaccardSimilarity` as a real, tiny re-implementation so drift
 * guard tests exercise real similarity math — the production one uses the
 * same formula.
 */
export function mockMemoryModule(content: string) {
  return {
    extractMemory: async (_provider: unknown, _input: unknown) => ({ content }),
    wordJaccardSimilarity: (a: string, b: string): number => {
      const tokens = (s: string) =>
        new Set(s.toLowerCase().match(/\w+/g) ?? []);
      const setA = tokens(a);
      const setB = tokens(b);
      if (setA.size === 0 && setB.size === 0) {
        return 1;
      }
      let intersection = 0;
      for (const t of setA) {
        if (setB.has(t)) {
          intersection += 1;
        }
      }
      const union = setA.size + setB.size - intersection;
      return union === 0 ? 0 : intersection / union;
    },
    MAX_MEMORY_WORDS: 225,
  };
}

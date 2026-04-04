import { jsonSchema } from "ai";

export interface ConceptResult {
  importance: number;
  name: string;
}

export interface EnrichmentResult {
  category: string;
  concepts: ConceptResult[];
  extractedEntities: string[];
  keyQuotes: string[];
  language: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  summary: string;
  tags: string[];
}

export const enrichmentSchema = jsonSchema<EnrichmentResult>({
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A concise 2-3 sentence summary of the content",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
      description:
        "Broad topic tags for categorization and browsing. Use lowercase, human-readable labels like 'machine-learning', 'personal-finance', 'web-development'. Prefer general topics over highly specific proper nouns. Use hyphens for multi-word tags.",
    },
    extractedEntities: {
      type: "array",
      items: { type: "string" },
      description:
        "People, places, organizations, and key concepts mentioned in the content",
    },
    sentiment: {
      type: "string",
      enum: ["positive", "negative", "neutral", "mixed"],
      description: "Overall sentiment of the content",
    },
    language: {
      type: "string",
      description: "ISO 639-1 language code of the content, e.g. 'en'",
    },
    category: {
      type: "string",
      description:
        "Single category: technology, science, business, health, politics, entertainment, education, sports, lifestyle, or other",
    },
    keyQuotes: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description: "Notable quotes or key sentences from the content",
    },
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "A key concept, topic, or theme. Use canonical names (e.g. 'React' not 'ReactJS')",
          },
          importance: {
            type: "number",
            description: "Importance weight 0.0 to 1.0",
          },
        },
        required: ["name", "importance"],
      },
      minItems: 3,
      maxItems: 10,
      description:
        "3-10 key concepts/topics extracted from the content, with importance weights",
    },
  },
  required: [
    "summary",
    "tags",
    "extractedEntities",
    "sentiment",
    "language",
    "category",
    "keyQuotes",
    "concepts",
  ],
});

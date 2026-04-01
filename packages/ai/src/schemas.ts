import { jsonSchema } from "ai";

export interface EnrichmentResult {
  category: string;
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
      description: "Relevant topic tags, lowercase, under 10 characters each",
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
  },
  required: [
    "summary",
    "tags",
    "extractedEntities",
    "sentiment",
    "language",
    "category",
    "keyQuotes",
  ],
});

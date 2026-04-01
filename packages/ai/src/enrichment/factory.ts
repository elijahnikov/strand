import type { createOpenAI } from "@ai-sdk/openai";
import type { ResourceEnricher } from "./base";
import { FileEnricher, type FileEnricherInput } from "./file";
import { NoteEnricher, type NoteEnricherInput } from "./note";
import { WebsiteEnricher, type WebsiteEnricherInput } from "./website";

export type EnricherInput =
  | { type: "website"; data: WebsiteEnricherInput }
  | { type: "note"; data: NoteEnricherInput }
  | { type: "file"; data: FileEnricherInput };

export function createEnricher(
  provider: ReturnType<typeof createOpenAI>,
  input: EnricherInput
): ResourceEnricher {
  switch (input.type) {
    case "website":
      return new WebsiteEnricher(provider, input.data);
    case "note":
      return new NoteEnricher(provider, input.data);
    case "file":
      return new FileEnricher(provider, input.data);
    default: {
      const exhaustive: never = input;
      throw new Error(`Unknown enricher type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

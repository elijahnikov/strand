import type { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { ResourceEnricher } from "./base";

export interface NoteEnricherInput {
  plainTextContent?: string;
  title: string;
}

const MAX_CONTENT_LENGTH = 12_000;

export class NoteEnricher extends ResourceEnricher {
  private readonly input: NoteEnricherInput;

  constructor(
    provider: ReturnType<typeof createOpenAI>,
    input: NoteEnricherInput
  ) {
    super(provider);
    this.input = input;
  }

  protected buildMessages(): CoreMessage[] {
    const content =
      this.input.plainTextContent?.slice(0, MAX_CONTENT_LENGTH) ??
      this.input.title;

    return [
      {
        role: "user",
        content: `You are an expert content analyst for a personal knowledge management system.

Analyze the following note and extract structured metadata. Be concise and accurate.

Title: ${this.input.title}

Content:
${content}`,
      },
    ];
  }
}

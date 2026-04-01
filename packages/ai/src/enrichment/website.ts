import type { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { ResourceEnricher } from "./base";

export interface WebsiteEnricherInput {
  articleContent?: string;
  ogDescription?: string;
  title: string;
  url: string;
}

const MAX_CONTENT_LENGTH = 12_000;

export class WebsiteEnricher extends ResourceEnricher {
  private readonly input: WebsiteEnricherInput;

  constructor(
    provider: ReturnType<typeof createOpenAI>,
    input: WebsiteEnricherInput
  ) {
    super(provider);
    this.input = input;
  }

  protected buildMessages(): CoreMessage[] {
    const content =
      this.input.articleContent?.slice(0, MAX_CONTENT_LENGTH) ??
      this.input.ogDescription ??
      this.input.title;

    return [
      {
        role: "user",
        content: `You are an expert content analyst for a personal knowledge management system.

Analyze the following web page and extract structured metadata. Be concise and accurate.

URL: ${this.input.url}
Title: ${this.input.title}

Content:
${content}`,
      },
    ];
  }
}

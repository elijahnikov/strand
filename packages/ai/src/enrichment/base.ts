import type { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { generateObject } from "ai";
import { type EnrichmentResult, enrichmentSchema } from "../schemas";

export abstract class ResourceEnricher {
  protected provider: ReturnType<typeof createOpenAI>;

  constructor(provider: ReturnType<typeof createOpenAI>) {
    this.provider = provider;
  }

  async enrich(): Promise<EnrichmentResult> {
    const messages = this.buildMessages();
    const result = await generateObject({
      model: this.provider("gpt-4o-mini"),
      schema: enrichmentSchema,
      messages,
    });
    return result.object;
  }

  protected abstract buildMessages(): CoreMessage[];
}

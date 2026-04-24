import type { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { generateObject } from "ai";
import { type EnrichmentResult, enrichmentSchema } from "../schemas";

export abstract class ResourceEnricher {
  protected provider: ReturnType<typeof createOpenAI>;

  constructor(provider: ReturnType<typeof createOpenAI>) {
    this.provider = provider;
  }

  async enrich(): Promise<{
    result: EnrichmentResult;
    tokens: number;
    model: string;
  }> {
    const messages = this.buildMessages();
    const model = "gpt-4o-mini";
    const { object, usage } = await generateObject({
      model: this.provider(model),
      schema: enrichmentSchema,
      messages,
    });
    return { result: object, tokens: usage?.totalTokens ?? 0, model };
  }

  protected abstract buildMessages(): CoreMessage[];
}

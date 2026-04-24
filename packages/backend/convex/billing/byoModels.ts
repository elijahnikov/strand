export const BYO_MODELS = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
} as const satisfies Record<BYOProvider, readonly string[]>;

export type BYOProvider = "openai" | "google" | "anthropic";

export type BYOModel<P extends BYOProvider = BYOProvider> =
  (typeof BYO_MODELS)[P][number];

export function defaultModelFor(provider: BYOProvider): string {
  return BYO_MODELS[provider][0];
}

export function isValidModelFor(provider: BYOProvider, model: string): boolean {
  return (BYO_MODELS[provider] as readonly string[]).includes(model);
}

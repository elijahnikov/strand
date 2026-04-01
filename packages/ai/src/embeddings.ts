import type { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_INPUT_LENGTH = 8000;

export async function generateEmbedding(
  provider: ReturnType<typeof createOpenAI>,
  text: string
): Promise<{ embedding: number[]; model: string }> {
  const { embedding } = await embed({
    model: provider.embedding(EMBEDDING_MODEL),
    value: text.slice(0, MAX_INPUT_LENGTH),
  });

  return { embedding, model: EMBEDDING_MODEL };
}

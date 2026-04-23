import type { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_INPUT_LENGTH = 8000;

export async function generateEmbedding(
  provider: ReturnType<typeof createOpenAI>,
  text: string
): Promise<{ embedding: number[]; model: string; tokens: number }> {
  const { embedding, usage } = await embed({
    model: provider.embedding(EMBEDDING_MODEL),
    value: text.slice(0, MAX_INPUT_LENGTH),
  });

  return { embedding, model: EMBEDDING_MODEL, tokens: usage?.tokens ?? 0 };
}

export async function generateEmbeddings(
  provider: ReturnType<typeof createOpenAI>,
  texts: string[]
): Promise<{ embeddings: number[][]; model: string; tokens: number }> {
  const { embeddings, usage } = await embedMany({
    model: provider.embedding(EMBEDDING_MODEL),
    values: texts.map((t) => t.slice(0, MAX_INPUT_LENGTH)),
  });

  return { embeddings, model: EMBEDDING_MODEL, tokens: usage?.tokens ?? 0 };
}

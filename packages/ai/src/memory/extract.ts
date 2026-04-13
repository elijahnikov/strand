import type { createOpenAI } from "@ai-sdk/openai";
import { generateObject, jsonSchema } from "ai";

export const MAX_MEMORY_WORDS = 225;

export interface MemoryMessage {
  content: string;
  role: "user" | "assistant";
}

export interface MemoryExtractionInput {
  existing: string;
  messages: MemoryMessage[];
}

export interface MemoryExtractionResult {
  content: string;
}

const memorySchema = jsonSchema<MemoryExtractionResult>({
  type: "object",
  properties: {
    content: {
      type: "string",
      description:
        "The updated user profile in markdown format. All required sections present, in the specified order.",
    },
  },
  required: ["content"],
});

const SYSTEM_PROMPT = `You maintain a compact, always-true profile of a user for an assistant's persistent memory across conversations. You will be given the EXISTING profile and recent chat turns. Return an UPDATED profile that preserves every still-valid fact from the existing profile and merges in new, clearly-stated information from the transcript.

Rules:
- Output ONLY the profile text in markdown. No preamble, no commentary.
- Hard cap: ${MAX_MEMORY_WORDS} words total across all sections. If adding would exceed this, drop the least specific or oldest item from the same section.
- Only record information directly stated or unambiguously implied by the user. Never infer preferences from a single offhand question.
- If a section has no content, write "-".
- Preserve exact user phrasings for hard preferences as one-line bullets.
- If the user contradicts an earlier fact, replace it; never keep both.
- Do not record transient context (e.g. "currently debugging X"). Only recurring patterns, long-lived projects, stable preferences.
- If no new information in this turn relates to a section, COPY THAT SECTION VERBATIM from the existing profile. Fidelity matters more than polish.
- Deletion protocol: an existing item may only be removed if the user contradicts it in the transcript. Otherwise keep it.

Required sections, in this exact order:
## Active Projects
(2-6 bullets: name — one-sentence scope)
## Writing & Communication Style
(observed style: verbosity, tone, formatting preferences)
## Recurring Interests
(topics the user returns to; max 10 bullets)
## People & Orgs Tracked
(name — one-line relationship/context)
## Hard Preferences
(each a single imperative bullet, e.g. "Always format code with tabs.")
## Notes
(catch-all; keep minimal)`;

function formatMessages(messages: MemoryMessage[]): string {
  return messages
    .map(
      (m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content.trim()}`
    )
    .join("\n\n");
}

export async function extractMemory(
  provider: ReturnType<typeof createOpenAI>,
  input: MemoryExtractionInput
): Promise<MemoryExtractionResult> {
  const existing =
    input.existing.trim().length > 0 ? input.existing.trim() : "(empty)";
  const transcript = formatMessages(input.messages);

  const result = await generateObject({
    model: provider("gpt-4o-mini"),
    schema: memorySchema,
    system: SYSTEM_PROMPT,
    prompt: `EXISTING PROFILE:\n${existing}\n\nRECENT CONVERSATION (oldest first):\n${transcript}`,
  });

  return result.object;
}

const WORD_TOKEN_RE = /[a-z0-9]+/g;
const MIN_WORD_LEN = 3;

function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(WORD_TOKEN_RE) ?? [];
  return new Set(tokens.filter((t) => t.length >= MIN_WORD_LEN));
}

export function wordJaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection++;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

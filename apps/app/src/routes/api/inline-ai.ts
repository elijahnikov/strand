import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { ConvexError } from "convex/values";
import { fetchAuthMutation, fetchAuthQuery, getToken } from "~/lib/auth-server";
import { getChatModel } from "~/lib/chat-server";

type Command = "improve" | "continue" | "summarize" | "ask";

interface InlineAIBody {
  command: Command;
  prompt?: string;
  selection: string;
  workspaceId: string;
}

const SYSTEM_PROMPTS: Record<Command, string> = {
  improve:
    "You are a writing assistant. Rewrite the user's text to improve clarity, grammar, and flow. Keep the original meaning and tone. Reply with only the rewritten text — no preamble, no explanations, no surrounding quotes.",
  continue:
    "You are a writing assistant. Continue the user's text naturally where it leaves off. Match their tone and style. Reply with only the continuation — no preamble.",
  summarize:
    "You are a writing assistant. Summarize the user's text concisely. Reply with only the summary — no preamble.",
  ask: "You are a writing assistant embedded in a note editor. Follow the user's instruction and produce only the requested text — no preamble, no explanations.",
};

function buildUserPrompt(body: InlineAIBody): string {
  switch (body.command) {
    case "improve":
      return body.selection;
    case "continue":
      return body.selection;
    case "summarize":
      return body.selection;
    case "ask": {
      const instruction = body.prompt ?? "";
      const ctx = body.selection.trim();
      if (!ctx) {
        return instruction;
      }
      return `${instruction}\n\nApply this to the following text:\n${ctx}`;
    }
    default:
      return body.selection;
  }
}

export const Route = createFileRoute("/api/inline-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = await getToken();
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as InlineAIBody;
        const { workspaceId, command, selection } = body;

        if (!(workspaceId && command)) {
          return new Response("Bad Request", { status: 400 });
        }
        if (
          command !== "improve" &&
          command !== "continue" &&
          command !== "summarize" &&
          command !== "ask"
        ) {
          return new Response("Bad command", { status: 400 });
        }
        if (command === "ask" && !body.prompt) {
          return new Response("Missing prompt", { status: 400 });
        }
        if (typeof selection !== "string") {
          return new Response("Missing selection", { status: 400 });
        }

        try {
          await fetchAuthQuery(api.chat.queries.preflightChat, {
            workspaceId: workspaceId as Id<"workspace">,
          });
        } catch (err) {
          if (
            err instanceof ConvexError &&
            String(err.data) === "Insufficient credits"
          ) {
            return new Response(
              JSON.stringify({ error: "insufficient_credits" }),
              {
                status: 402,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          throw err;
        }

        const { model, modelId } = await getChatModel(workspaceId);
        try {
          const result = await generateText({
            model,
            system: SYSTEM_PROMPTS[command],
            messages: [{ role: "user", content: buildUserPrompt(body) }],
          });

          fetchAuthMutation(api.chat.mutations.recordInlineAIUsage, {
            workspaceId: workspaceId as Id<"workspace">,
            model: modelId,
            promptTokens: result.usage?.inputTokens ?? 0,
            completionTokens: result.usage?.outputTokens ?? 0,
          }).catch((err) => {
            console.error("[recordInlineAIUsage] failed:", err);
          });

          return new Response(result.text, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[inline-ai] generateText failed:", err);
          return new Response(message || "AI request failed", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});

import { openai } from "@ai-sdk/openai";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { stepCountIs, streamText } from "ai";
import { fetchAuthMutation, getToken } from "~/lib/auth-server";
import {
  buildRAGContext,
  buildSystemPrompt,
  createChatTools,
  extractCitations,
  extractToolPartsFromSteps,
  generateThreadTitle,
  PERSISTED_TOOL_NAMES,
  saveAssistantMessage,
} from "~/lib/chat-server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = await getToken();
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = await request.json();
        const { messages, threadId, workspaceId, resourceId } = body as {
          messages: Array<{
            role: string;
            content?: string;
            parts?: Array<{ type: string; text?: string }>;
          }>;
          threadId?: string;
          workspaceId: string;
          resourceId?: string;
        };

        if (!(workspaceId && messages?.length)) {
          return new Response("Bad Request", { status: 400 });
        }

        const lastUserMessage = messages.at(-1);
        if (!lastUserMessage || lastUserMessage.role !== "user") {
          return new Response("Bad Request", { status: 400 });
        }

        const lastUserContent =
          lastUserMessage.content ??
          lastUserMessage.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("") ??
          "";

        if (!threadId) {
          return new Response("Bad Request: threadId required", {
            status: 400,
          });
        }

        await fetchAuthMutation(api.chat.mutations.saveUserMessage, {
          workspaceId: workspaceId as Id<"workspace">,
          threadId: threadId as Id<"chatThread">,
          content: lastUserContent,
        });

        const ragContext = await buildRAGContext(
          workspaceId,
          lastUserContent,
          resourceId
        );

        const systemPrompt = buildSystemPrompt(ragContext);

        const tools = createChatTools(workspaceId);

        const result = streamText({
          model: openai("gpt-4.1-mini"),
          system: systemPrompt,
          tools,
          stopWhen: stepCountIs(5),
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content:
              m.content ??
              m.parts
                ?.filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("") ??
              "",
          })),
          onFinish: async ({ text, steps }) => {
            const citations = extractCitations(ragContext);
            const toolParts = extractToolPartsFromSteps(
              steps,
              PERSISTED_TOOL_NAMES
            );
            await saveAssistantMessage(
              workspaceId,
              threadId as string,
              text,
              citations,
              toolParts
            );

            const isFirstExchange =
              messages.filter((m) => m.role === "user").length === 1;
            if (isFirstExchange) {
              generateThreadTitle(lastUserContent, text)
                .then((title) =>
                  fetchAuthMutation(api.chat.mutations.updateThreadTitle, {
                    workspaceId: workspaceId as Id<"workspace">,
                    threadId: threadId as Id<"chatThread">,
                    title,
                  })
                )
                .catch((err) => {
                  console.error("[generateThreadTitle] failed:", err);
                });
            }
          },
        });

        return result.toUIMessageStreamResponse({
          headers: {
            "X-Thread-Id": threadId as string,
          },
        });
      },
    },
  },
});

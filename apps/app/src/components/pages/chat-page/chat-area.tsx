import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Skeleton } from "@strand/ui/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { TextShimmer } from "~/components/common/text-shimmer";
import { useLibraryChat } from "~/hooks/use-library-chat";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";

const TOOL_LABELS: Record<string, string> = {
  searchLibrary: "Searching library...",
  getResourceDetails: "Reading resource...",
};

function StreamingIndicator({ messages }: { messages: UIMessage[] }) {
  const lastMessage = messages.at(-1);

  // Check if the last assistant message has an in-progress tool invocation
  if (lastMessage?.role === "assistant") {
    const toolPart = lastMessage.parts.find(
      (p) =>
        p.type.startsWith("tool-") &&
        "state" in p &&
        p.state !== "output-available"
    );
    if (toolPart && "toolCallId" in toolPart) {
      // Extract tool name from the type field (e.g. "tool-invocation" parts have type like "tool-searchLibrary")
      const toolName = toolPart.type.replace("tool-", "");
      const label = TOOL_LABELS[toolName] ?? "Using tool...";
      return (
        <div className="ml-4 flex items-center gap-2">
          <DotGridLoader />
          <TextShimmer className="ml-2 text-[13px]">{label}</TextShimmer>
        </div>
      );
    }

    // Assistant message exists with text content — model is streaming text, no indicator needed
    const hasText = lastMessage.parts.some(
      (p) => p.type === "text" && "text" in p && (p.text as string).length > 0
    );
    if (hasText) {
      return null;
    }
  }

  // Default: waiting for first response
  return (
    <div className="ml-4 flex items-center gap-2">
      <DotGridLoader />
      <TextShimmer className="ml-2 text-[13px]">Thinking...</TextShimmer>
    </div>
  );
}

function convertToUIMessages(
  messages: Array<{
    _id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }>
): UIMessage[] {
  return messages.map((m) => ({
    id: m._id,
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
    createdAt: new Date(m.createdAt),
  }));
}

export function ChatArea({
  workspaceId,
  threadId,
  resourceId,
  onThreadCreated,
}: {
  workspaceId: Id<"workspace">;
  threadId?: Id<"chatThread">;
  resourceId?: Id<"resource">;
  onThreadCreated?: (threadId: Id<"chatThread">) => void;
}) {
  const { mutateAsync: createThread } = useMutation({
    mutationFn: useConvexMutation(api.chat.mutations.createThread),
  });

  const { data: thread, isLoading: isLoadingThread } = useQuery(
    convexQuery(
      api.chat.queries.getThread,
      threadId ? { threadId, workspaceId } : "skip"
    )
  );

  const { messages, sendMessage, setMessages, status, stop } = useLibraryChat({
    workspaceId,
    threadId,
    resourceId,
  });

  const hasSyncedRef = useRef(false);
  const prevThreadIdRef = useRef(threadId);

  // Reset sync flag when threadId changes (switching threads)
  if (prevThreadIdRef.current !== threadId) {
    prevThreadIdRef.current = threadId;
    hasSyncedRef.current = false;
  }

  useEffect(() => {
    if (thread?.messages?.length && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      setMessages(convertToUIMessages(thread.messages));
    }
  }, [thread?.messages, setMessages]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const lastMessageContent = messages
    .at(-1)
    ?.parts?.filter(
      (p): p is Extract<typeof p, { type: "text" }> => p.type === "text"
    )
    .map((p) => p.text)
    .join("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages and streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, lastMessageContent]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSend = useCallback(
    async (content: string, _mentions: unknown[]) => {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await createThread({ workspaceId, resourceId });
        onThreadCreated?.(currentThreadId);
      }
      sendMessage({ text: content }, { body: { threadId: currentThreadId } });
    },
    [
      threadId,
      createThread,
      workspaceId,
      resourceId,
      onThreadCreated,
      sendMessage,
    ]
  );

  if (threadId && isLoadingThread) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
            {/* User message skeleton */}
            <div className="flex flex-row-reverse gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            {/* Assistant message skeleton */}
            <div className="flex gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-72 rounded-xl" />
                <Skeleton className="h-4 w-56 rounded-xl" />
                <Skeleton className="h-4 w-64 rounded-xl" />
              </div>
            </div>
            {/* User message skeleton */}
            <div className="flex flex-row-reverse gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
            {/* Assistant message skeleton */}
            <div className="flex gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-64 rounded-xl" />
                <Skeleton className="h-4 w-80 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        <ChatInput isStreaming={false} onSend={handleSend} onStop={stop} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 px-4 py-8">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20">
              <p className="font-medium text-lg">Ask your library</p>
              <p className="text-muted-foreground text-sm">
                Ask questions about your saved resources
              </p>
            </div>
          )}
          {messages.map((message, idx) => {
            const isLast = idx === messages.length - 1;
            // Skip rendering an assistant bubble with no text yet (e.g.
            // while tool calls are in flight). The StreamingIndicator below
            // covers that state to avoid showing two loaders at once.
            const hasText = message.parts.some(
              (p) =>
                p.type === "text" &&
                "text" in p &&
                (p.text as string).length > 0
            );
            if (
              isLast &&
              isStreaming &&
              message.role === "assistant" &&
              !hasText
            ) {
              return null;
            }
            return (
              <MessageBubble
                isStreaming={isStreaming && isLast}
                key={message.id}
                message={message}
              />
            );
          })}
          {isStreaming && <StreamingIndicator messages={messages} />}
        </div>
      </div>
      <ChatInput isStreaming={isStreaming} onSend={handleSend} onStop={stop} />
    </div>
  );
}

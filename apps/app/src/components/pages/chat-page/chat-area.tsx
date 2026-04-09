import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { useLibraryChat } from "~/hooks/use-library-chat";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";

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
  onThreadCreated,
}: {
  workspaceId: Id<"workspace">;
  threadId?: Id<"chatThread">;
  onThreadCreated?: (threadId: Id<"chatThread">) => void;
}) {
  const { mutateAsync: createThread } = useMutation({
    mutationFn: useConvexMutation(api.chat.mutations.createThread),
  });

  const { data: thread } = useQuery(
    threadId
      ? convexQuery(api.chat.queries.getThread, { threadId, workspaceId })
      : { queryKey: ["chat", "thread", "none"], queryFn: () => null }
  );

  const initialMessages = thread?.messages
    ? convertToUIMessages(thread.messages)
    : undefined;

  const { messages, sendMessage, status, stop } = useLibraryChat({
    workspaceId,
    threadId,
    initialMessages,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSend = useCallback(
    async (content: string) => {
      let currentThreadId = threadIdRef.current;
      if (!currentThreadId) {
        currentThreadId = await createThread({ workspaceId });
        threadIdRef.current = currentThreadId;
        onThreadCreated?.(currentThreadId);
      }
      sendMessage({ text: content }, { body: { threadId: currentThreadId } });
    },
    [createThread, workspaceId, onThreadCreated, sendMessage]
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20">
              <p className="font-medium text-lg">Ask your library</p>
              <p className="text-muted-foreground text-sm">
                Ask questions about your saved resources
              </p>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isStreaming && messages.at(-1)?.role !== "assistant" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              Thinking...
            </div>
          )}
        </div>
      </div>
      <ChatInput isStreaming={isStreaming} onSend={handleSend} onStop={stop} />
    </div>
  );
}

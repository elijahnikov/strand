import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export function useLibraryChat({
  workspaceId,
  threadId,
  resourceId,
  initialMessages,
}: {
  workspaceId: string;
  threadId?: string;
  resourceId?: string;
  initialMessages?: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          workspaceId,
          threadId,
          resourceId,
        },
      }),
    [workspaceId, threadId, resourceId]
  );

  return useChat({
    transport,
    messages: initialMessages,
  });
}

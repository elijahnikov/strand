import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export function useLibraryChat({
  workspaceId,
  threadId,
  resourceId,
  onError,
}: {
  workspaceId: string;
  threadId?: string;
  resourceId?: string;
  onError?: (error: Error) => void;
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

  return useChat({ transport, onError });
}

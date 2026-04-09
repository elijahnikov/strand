import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useCallback, useState } from "react";
import { ChatArea } from "./chat-area";
import { ThreadList } from "./thread-list";

export function ChatPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const [activeThreadId, setActiveThreadId] = useState<
    Id<"chatThread"> | undefined
  >();
  const [chatKey, setChatKey] = useState(0);
  const handleNewChat = useCallback(() => {
    setActiveThreadId(undefined);
    setChatKey((k) => k + 1);
  }, []);

  const handleSelectThread = useCallback((threadId: Id<"chatThread">) => {
    setActiveThreadId(threadId);
    setChatKey((k) => k + 1);
  }, []);

  const handleThreadCreated = useCallback((threadId: Id<"chatThread">) => {
    setActiveThreadId(threadId);
    // Don't change chatKey — avoid remounting ChatArea
  }, []);

  return (
    <div className="flex h-full">
      <ThreadList
        activeThreadId={activeThreadId}
        onNewChat={handleNewChat}
        onSelectThread={handleSelectThread}
        workspaceId={workspaceId}
      />
      <ChatArea
        key={chatKey}
        onThreadCreated={handleThreadCreated}
        threadId={activeThreadId}
        workspaceId={workspaceId}
      />
    </div>
  );
}

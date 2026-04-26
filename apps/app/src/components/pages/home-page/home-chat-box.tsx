import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { ChatInput } from "~/components/pages/chat-page/chat-input";

export function HomeChatBox({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const navigate = useNavigate();

  const handleSend = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }
      navigate({
        to: "/workspace/$workspaceId/chat",
        params: { workspaceId },
        search: { q: trimmed, submit: 1 },
      });
    },
    [navigate, workspaceId]
  );

  return (
    <div className="-mt-4 mb-14">
      <ChatInput
        fullWidth
        isStreaming={false}
        onSend={handleSend}
        onStop={() => {
          // no-op — home box never streams
        }}
      />
    </div>
  );
}

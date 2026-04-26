import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatArea } from "~/components/pages/chat-page/chat-area";
import { ThreadList } from "~/components/pages/chat-page/thread-list";

interface ChatSearch {
  q?: string;
  submit?: 1;
}

export const Route = createFileRoute("/_workspace/workspace/$workspaceId/chat")(
  {
    component: ChatLayout,
    validateSearch: (search: Record<string, unknown>): ChatSearch => {
      const out: ChatSearch = {};
      if (typeof search.q === "string" && search.q.length > 0) {
        out.q = search.q;
      }
      if (search.submit === 1 || search.submit === "1") {
        out.submit = 1;
      }
      return out;
    },
  }
);

function ChatLayout() {
  const { workspaceId, threadId: routeThreadId } = useParams({
    strict: false,
  }) as {
    workspaceId: string;
    threadId?: string;
  };
  const navigate = useNavigate();
  const { q: seededQuery, submit: seededSubmit } = useSearch({
    from: "/_workspace/workspace/$workspaceId/chat",
  });

  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(
    routeThreadId
  );

  const [chatKey, setChatKey] = useState(() => routeThreadId ?? "new");
  const justCreatedRef = useRef(false);

  useEffect(() => {
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }
    setActiveThreadId(routeThreadId);
    setChatKey(routeThreadId ?? "new");
  }, [routeThreadId]);

  const handleNewChat = useCallback(() => {
    setActiveThreadId(undefined);
    setChatKey("new");
    navigate({
      to: "/workspace/$workspaceId/chat",
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  const handleThreadCreated = useCallback(
    (newThreadId: Id<"chatThread">) => {
      justCreatedRef.current = true;
      setActiveThreadId(newThreadId);
      navigate({
        to: "/workspace/$workspaceId/chat/$threadId",
        params: { workspaceId, threadId: newThreadId },
        replace: true,
      });
    },
    [navigate, workspaceId]
  );

  return (
    <div className="flex h-full">
      <ThreadList
        activeThreadId={activeThreadId as Id<"chatThread"> | undefined}
        onNewChat={handleNewChat}
        workspaceId={workspaceId as Id<"workspace">}
      />
      <ChatArea
        autoSend={!activeThreadId && seededSubmit === 1}
        initialValue={activeThreadId ? undefined : seededQuery}
        key={chatKey}
        onThreadCreated={handleThreadCreated}
        threadId={activeThreadId as Id<"chatThread"> | undefined}
        workspaceId={workspaceId as Id<"workspace">}
      />
      <Outlet />
    </div>
  );
}

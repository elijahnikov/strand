import { useConvexPaginatedQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { ScrollArea } from "@strand/ui/scroll-area";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function ThreadList({
  workspaceId,
  activeThreadId,
  onSelectThread,
  onNewChat,
}: {
  workspaceId: Id<"workspace">;
  activeThreadId?: Id<"chatThread">;
  onSelectThread: (threadId: Id<"chatThread">) => void;
  onNewChat: () => void;
}) {
  const { results: threads, isLoading } = useConvexPaginatedQuery(
    api.chat.queries.listThreads,
    { workspaceId },
    { initialNumItems: 50 }
  );

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r">
      {/* <div className="flex items-center justify-between border-b p-3">
        <span className="font-medium text-sm">Threads</span>
        <Button onClick={onNewChat} size="small" variant="ghost">
          <RiAddLine className="size-4" />
        </Button>
      </div> */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {threads.map((thread) => (
            <button
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                activeThreadId === thread._id && "bg-muted"
              )}
              key={thread._id}
              onClick={() => onSelectThread(thread._id)}
              type="button"
            >
              <span className="line-clamp-1 font-medium">
                {thread.title ?? "New chat"}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(thread.lastMessageAt)}
              </span>
            </button>
          ))}
          {threads.length === 0 && !isLoading && (
            <div className="px-3 py-6 text-center text-muted-foreground text-sm">
              No conversations yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

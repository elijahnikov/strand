import { useConvexPaginatedQuery } from "@convex-dev/react-query";
import { RiAddLine } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import { ScrollArea } from "@strand/ui/scroll-area";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

function ThreadListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 17 }).map((_, i) => (
        <Skeleton className="h-8 w-full rounded-md" key={i} />
      ))}
    </div>
  );
}

export function ThreadList({
  workspaceId,
  activeThreadId,
  onNewChat,
}: {
  workspaceId: Id<"workspace">;
  activeThreadId?: Id<"chatThread">;
  onNewChat: () => void;
}) {
  const { results: threads, status } = useConvexPaginatedQuery(
    api.chat.queries.listThreads,
    { workspaceId },
    { initialNumItems: 50 }
  );

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (threads.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
    }
  }, [threads.length]);

  const isFirstLoad = status === "LoadingFirstPage" && threads.length === 0;

  return (
    <div className="relative flex h-full w-64 shrink-0 flex-col">
      <div className="flex items-center justify-between pt-2 pl-2">
        <Button
          className="mr-2"
          onClick={onNewChat}
          size="small"
          variant="outline"
        >
          New chat
          <RiAddLine className="size-4 shrink-0" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {isFirstLoad ? (
          <ThreadListSkeleton />
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            <AnimatePresence>
              {threads.map((thread, i) => (
                <Link
                  key={thread._id}
                  params={{
                    workspaceId: workspaceId as string,
                    threadId: thread._id as string,
                  }}
                  preload="intent"
                  to="/workspace/$workspaceId/chat/$threadId"
                >
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      activeThreadId === thread._id && "bg-muted"
                    )}
                    exit={{ opacity: 0, height: 0 }}
                    initial={
                      initialLoadDone.current ? false : { opacity: 0, y: 8 }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                      delay: initialLoadDone.current ? 0 : i * 0.03,
                    }}
                  >
                    <Text className="line-clamp-1 font-medium" size="small">
                      {thread.title ?? "New chat"}
                    </Text>
                  </motion.div>
                </Link>
              ))}
            </AnimatePresence>
            {threads.length === 0 && (
              <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                No conversations yet
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

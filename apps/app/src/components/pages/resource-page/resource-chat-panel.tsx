import { convexQuery } from "@convex-dev/react-query";
import { RiArrowRightUpLine, RiChat3Line, RiCloseLine } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Button } from "@strand/ui/button";
import { Text } from "@strand/ui/text";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChatArea } from "~/components/pages/chat-page/chat-area";

export function ResourceChatPanel({
  open,
  onOpenChange,
  workspaceId,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspace">;
  resource: { _id: Id<"resource">; title: string; type: string };
}) {
  const navigate = useNavigate();

  const { data: latestThread, isLoading } = useQuery(
    convexQuery(
      api.chat.queries.getLatestThreadForResource,
      open ? { workspaceId, resourceId: resource._id } : "skip"
    )
  );

  const handleExpand = () => {
    if (latestThread?._id) {
      navigate({
        to: "/workspace/$workspaceId/chat/$threadId",
        params: {
          workspaceId: workspaceId as string,
          threadId: latestThread._id as string,
        },
      });
    } else {
      navigate({
        to: "/workspace/$workspaceId/chat",
        params: { workspaceId: workspaceId as string },
      });
    }
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ y: 0, opacity: 1 }}
          className="fixed right-4 bottom-4 z-50 flex h-[600px] max-h-[calc(100vh-2rem)] w-[420px] flex-col overflow-hidden rounded-xl border-[0.5px] bg-ui-bg-subtle shadow-lg"
          exit={{ y: 700, opacity: 0 }}
          initial={{ y: 700, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        >
          <div className="flex items-center justify-between border-b-[0.5px] px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <RiChat3Line className="size-4 shrink-0 text-ui-fg-muted" />
              <Text className="truncate font-medium" size="small">
                {resource.title}
              </Text>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-label="Open in chat page"
                className="size-6"
                onClick={handleExpand}
                size="xsmall"
                variant="ghost"
              >
                <RiArrowRightUpLine className="size-4 shrink-0" />
              </Button>
              <Button
                aria-label="Close chat"
                className="size-6"
                onClick={() => onOpenChange(false)}
                size="xsmall"
                variant="ghost"
              >
                <RiCloseLine className="size-4 shrink-0" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {isLoading ? null : (
              <ChatArea
                resourceId={resource._id}
                threadId={
                  (latestThread?._id as Id<"chatThread"> | undefined) ??
                  undefined
                }
                workspaceId={workspaceId}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

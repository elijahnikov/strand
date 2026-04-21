import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { Separator } from "@omi/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@omi/ui/tooltip";
import { RiChatAi3Fill } from "@remixicon/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { EditableText } from "~/components/common/editable-text";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { MiddleTruncate } from "~/components/common/middle-truncate";
import { ShortcutTooltipBody } from "~/components/common/shortcut-tooltip";
import { UserAvatar } from "~/components/common/user-avatar";
import type { GetResourceData } from "~/lib/convex-types";
import { ResourceChatPanel } from "./resource-chat-panel";

export function ResourceHeader({ resource }: { resource: GetResourceData }) {
  const { workspaceId } = useParams({
    from: "/_workspace/workspace/$workspaceId/resource/$resourceId",
  });

  const [chatOpen, setChatOpen] = useState(false);

  useHotkey("Shift+C", () => {
    setChatOpen((prev) => !prev);
  });

  const aiStatus = resource.resourceAI?.status;
  const isAiProcessing = aiStatus === "pending" || aiStatus === "processing";

  const queryClient = useQueryClient();
  const queryKey = convexQuery(api.resource.queries.get, {
    workspaceId: workspaceId as Id<"workspace">,
    resourceId: resource._id,
  }).queryKey;

  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });

  const handleSave = useCallback(
    (title: string) => {
      updateTitle({
        resourceId: resource._id,
        title,
        workspaceId: workspaceId as Id<"workspace">,
      });
      queryClient.setQueryData(queryKey, (prev: GetResourceData | undefined) =>
        prev ? { ...prev, title } : prev
      );
    },
    [updateTitle, resource._id, workspaceId, queryClient, queryKey]
  );

  return (
    <div className="flex flex-col gap-y-1">
      <div className="relative flex w-full items-center">
        <AnimatePresence>
          {isAiProcessing && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -left-5"
              exit={{ opacity: 0, scale: 0.5 }}
              initial={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <DotGridLoader />
            </motion.div>
          )}
        </AnimatePresence>
        <EditableText
          className="h1-core font-medium font-sans"
          onSave={handleSave}
          value={resource.title}
        />
      </div>
      <div className="absolute top-1.5 right-1.5 z-50 ml-auto flex size-8 shrink-0 items-center gap-x-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Chat about this resource"
                className="size-8 shrink-0"
                onClick={() => setChatOpen(true)}
                size="small"
                variant="ghost"
              />
            }
          >
            <RiChatAi3Fill className="size-4 shrink-0 text-ui-fg-subtle group-hover:text-ui-fg-base" />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <ShortcutTooltipBody
              shortcut={["Shift+C"]}
              title="Chat about resource"
            />
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TypeBadge resource={resource} />
        {resource.type !== "note" && (
          <Separator className="h-4" orientation="vertical" />
        )}
        <Badge className="text-xs" variant="mono">
          {format(new Date(resource._creationTime), "d MMM yyyy HH:mm")}
        </Badge>
        <Separator className="h-4" orientation="vertical" />
        <Badge className="text-xs" variant="mono">
          <UserAvatar
            className="size-3.5"
            image={resource.createdBy?.image}
            name={resource.createdBy?.username ?? ""}
            size={14}
          />
          {resource.createdBy?.username}
        </Badge>
      </div>
      <ResourceChatPanel
        onOpenChange={setChatOpen}
        open={chatOpen}
        resource={{
          _id: resource._id,
          title: resource.title,
          type: resource.type,
        }}
        workspaceId={workspaceId as Id<"workspace">}
      />
    </div>
  );
}

function TypeBadge({ resource }: { resource: GetResourceData }) {
  switch (resource.type) {
    case "website": {
      const website = "website" in resource ? resource.website : null;
      if (!website) {
        return null;
      }
      return (
        <a
          className="flex max-w-[420px]"
          href={website.url}
          rel="noopener"
          target="_blank"
        >
          <Badge
            className="max-w-full text-ui-fg-subtle text-xs"
            variant="mono"
          >
            <img
              alt={website.url}
              className="shrink-0 rounded-[4px]"
              height={14}
              src={website.favicon}
              width={14}
            />
            <span className="shrink-0 font-medium text-ui-fg-base">
              {new URL(website.url).hostname}
            </span>
            <span className="-ml-1 min-w-0 flex-1">
              <MiddleTruncate text={new URL(website.url).pathname} />
            </span>
          </Badge>
        </a>
      );
    }
    case "file": {
      const file = "file" in resource ? resource.file : null;
      if (!file) {
        return null;
      }
      return (
        <Badge className="max-w-[460px] text-xs" variant="mono">
          <FileKindIcon
            className="h-3.5 w-3.5 shrink-0"
            fileName={file.fileName}
            mimeType={file.mimeType}
          />
          <span className="min-w-0 flex-1">
            <MiddleTruncate text={file.fileName} />
          </span>
        </Badge>
      );
    }
    default:
      return null;
  }
}

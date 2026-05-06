import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { Separator } from "@omi/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@omi/ui/tooltip";
import {
  RiArrowRightUpLine,
  RiChatAi3Fill,
  RiDiscussFill,
} from "@remixicon/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { type FC, type SVGProps, useCallback } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { EditableText } from "~/components/common/editable-text";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { MiddleTruncate } from "~/components/common/middle-truncate";
import { ShortcutTooltipBody } from "~/components/common/shortcut-tooltip";
import { UserAvatar } from "~/components/common/user-avatar";
import {
  GitHub,
  Notion,
} from "~/components/pages/settings-page/import-tab/integration-logos";
import type { GetResourceData } from "~/lib/convex-types";
import { useFloatingPanelsStore } from "./floating-panels-store";
import { ResourceActionsMenu } from "./resource-actions-menu";
import { ResourceChatPanel } from "./resource-chat-panel";
import { ResourceCommentsPanel } from "./resource-comments-panel";

export function ResourceHeader({ resource }: { resource: GetResourceData }) {
  const workspaceId = resource.workspaceId;

  const togglePanel = useFloatingPanelsStore((s) => s.togglePanel);
  const openPanel = useFloatingPanelsStore((s) => s.openPanel);
  const closePanel = useFloatingPanelsStore((s) => s.closePanel);

  useHotkey("Shift+C", () => {
    togglePanel("chat");
  });
  useHotkey("Shift+D", () => {
    togglePanel("comments");
  });
  useHotkey("Escape", () => {
    const { active, open } = useFloatingPanelsStore.getState();
    const target = active ?? open.at(-1);
    if (target) {
      closePanel(target);
    }
  });

  const { data: unreadInfo } = useQuery(
    convexQuery(api.resourceComment.queries.getUnreadInfo, {
      workspaceId,
      resourceId: resource._id,
    })
  );
  const hasUnread = unreadInfo?.hasUnread ?? false;

  const aiStatus = resource.resourceAI?.status;
  const isAiProcessing = aiStatus === "pending" || aiStatus === "processing";

  const queryClient = useQueryClient();
  const queryKey = convexQuery(api.resource.queries.get, {
    workspaceId,
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
        workspaceId,
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
      <div className="absolute top-1.5 right-1.5 z-50 ml-auto flex size-8 w-max shrink-0 items-center gap-x-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Open comments"
                className="relative size-8 shrink-0"
                onClick={() => openPanel("comments")}
                size="small"
                variant="ghost"
              />
            }
          >
            <RiDiscussFill className="size-4 shrink-0 text-ui-fg-subtle group-hover:text-ui-fg-base" />
            <AnimatePresence>
              {hasUnread && (
                <motion.span
                  animate={{ opacity: 1, scale: 1 }}
                  className="pointer-events-none absolute -top-0.5 -right-0.5"
                  exit={{ opacity: 0, scale: 0.5 }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <span className="relative block size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/70" />
                    <span className="relative block size-2 rounded-full bg-blue-500" />
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <ShortcutTooltipBody shortcut={["Shift+D"]} title="Comments" />
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Chat about this resource"
                className="size-8 shrink-0"
                onClick={() => openPanel("chat")}
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
        <ResourceActionsMenu resource={resource} workspaceId={workspaceId} />
      </div>
      <div className="flex w-full min-w-0 items-center gap-x-2">
        <TypeBadge resource={resource} />
        {resource.type !== "note" && (
          <Separator className="h-4 shrink-0" orientation="vertical" />
        )}
        <SyncedFromBadge
          providerId={
            "sourceProviderId" in resource
              ? resource.sourceProviderId
              : undefined
          }
        />
        <Badge className="shrink-0 text-xs" variant="mono">
          {format(new Date(resource._creationTime), "d MMM yyyy HH:mm")}
        </Badge>
        <Separator className="h-4 shrink-0" orientation="vertical" />
        <Badge className="shrink-0 text-xs" variant="mono">
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
        resource={{
          _id: resource._id,
          title: resource.title,
          type: resource.type,
        }}
        workspaceId={workspaceId}
      />
      <ResourceCommentsPanel
        resource={{ _id: resource._id, title: resource.title }}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// Surfaces "Synced from <provider>" on resources created by the sync worker
// (sourceProviderId is only set by upsertSyncedResource). Manually-clipped
// resources from the same sites won't carry this field and won't render.
type LogoSvg = FC<SVGProps<SVGSVGElement>>;
const SYNC_PROVIDER_LABEL: Record<string, { label: string; Logo: LogoSvg }> = {
  notion: { label: "Notion", Logo: Notion },
  github: { label: "GitHub", Logo: GitHub },
};

function SyncedFromBadge({ providerId }: { providerId: string | undefined }) {
  if (!providerId) {
    return null;
  }
  const entry = SYNC_PROVIDER_LABEL[providerId];
  if (!entry) {
    return null;
  }
  const { Logo, label } = entry;
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge className="shrink-0 text-xs" variant="mono">
              <Logo className="size-3.5 shrink-0" />
              <span>Synced from {label}</span>
            </Badge>
          }
        />
        <TooltipContent side="bottom">
          This resource is kept in sync with {label}. Edits here may be
          overwritten on the next change there.
        </TooltipContent>
      </Tooltip>
      <Separator className="h-4 shrink-0" orientation="vertical" />
    </>
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
          className="flex min-w-0 max-w-[420px]"
          href={website.url}
          rel="noopener"
          target="_blank"
        >
          <Badge
            className="min-w-0 max-w-full text-ui-fg-subtle text-xs"
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
            <span className="-ml-1 inline-block min-w-0 flex-1">
              <MiddleTruncate text={new URL(website.url).pathname} />
            </span>
            <RiArrowRightUpLine className="shrink-0" />
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
        <Badge className="min-w-0 max-w-[460px] text-xs" variant="mono">
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

import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { toastManager } from "@omi/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@omi/ui/tooltip";
import { RiMoreFill } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CopyIcon,
  Link2Icon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import type { GetResourceData } from "~/lib/convex-types";
import { ResourceSharePopover } from "./resource-share-popover";

const WHITESPACE = /\s+/;

interface ResourceActionsMenuProps {
  resource: GetResourceData;
  workspaceId: Id<"workspace">;
}

export function ResourceActionsMenu({
  resource,
  workspaceId,
}: ResourceActionsMenuProps) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });
  const { mutateAsync: removeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });

  const handleCopyLink = async () => {
    const path = `/workspace/${workspaceId}/resource/${resource._id}`;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toastManager.add({ type: "success", title: "Link copied" });
    } catch {
      toastManager.add({ type: "error", title: "Couldn't copy link" });
    }
  };

  const handleDelete = async () => {
    try {
      await removeMany({ workspaceId, resourceIds: [resource._id] });
      toastManager.add({ type: "success", title: "Moved to trash" });
      navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId: workspaceId as string },
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Couldn't delete",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const plainText =
    resource.type === "note" && "note" in resource
      ? (resource.note?.plainTextContent ?? "")
      : "";
  const charCount = plainText.length;
  const wordCount = plainText.trim()
    ? plainText.trim().split(WHITESPACE).length
    : 0;

  return (
    <>
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label="More actions"
                    className="-ml-1 size-8 shrink-0"
                    ref={triggerRef}
                    size="small"
                    variant="ghost"
                  >
                    <RiMoreFill className="size-4 shrink-0 text-ui-fg-subtle group-hover:text-ui-fg-base" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent side="bottom">More actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56" sideOffset={6}>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setTimeout(() => setShareOpen(true), 0);
            }}
          >
            <Link2Icon className="size-4" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            <CopyIcon className="size-4" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => togglePin({ workspaceId, resourceId: resource._id })}
          >
            {resource.isPinned ? (
              <PinOffIcon className="size-4" />
            ) : (
              <PinIcon className="size-4" />
            )}
            {resource.isPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-ui-fg-error" onClick={handleDelete}>
            <TrashIcon className="size-4 text-ui-fg-error! group-hover/menuitem:text-ui-fg-base!" />
            Delete
          </DropdownMenuItem>
          {resource.type === "note" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-default text-ui-fg-subtle text-xs hover:bg-transparent!"
                disabled
              >
                {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount}{" "}
                {charCount === 1 ? "character" : "characters"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResourceSharePopover
        anchor={triggerRef}
        onOpenChange={setShareOpen}
        open={shareOpen}
        resourceId={resource._id}
        share={resource.share ?? null}
        workspaceId={workspaceId}
      />
    </>
  );
}

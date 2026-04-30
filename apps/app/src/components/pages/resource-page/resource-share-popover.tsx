import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import CopyButton from "@omi/ui/copy-button";
import { Switch } from "@omi/ui/switch";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation } from "@tanstack/react-query";
import type { RefObject } from "react";
import { useState } from "react";

interface ResourceSharePopoverProps {
  anchor: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  resourceId: Id<"resource">;
  share: { slug: string } | null;
  workspaceId: Id<"workspace">;
}

export function ResourceSharePopover({
  anchor,
  open,
  onOpenChange,
  resourceId,
  workspaceId,
  share,
}: ResourceSharePopoverProps) {
  const [optimisticSlug, setOptimisticSlug] = useState<string | null>(null);
  const slug = optimisticSlug ?? share?.slug ?? null;
  const isShared = slug !== null;

  const { mutateAsync: enableShare, isPending: enabling } = useMutation({
    mutationFn: useConvexMutation(api.resourceShare.mutations.enable),
  });
  const { mutateAsync: disableShare, isPending: disabling } = useMutation({
    mutationFn: useConvexMutation(api.resourceShare.mutations.disable),
  });

  const handleToggle = async (next: boolean) => {
    try {
      if (next) {
        const result = await enableShare({ workspaceId, resourceId });
        setOptimisticSlug(result.slug);
      } else {
        await disableShare({ workspaceId, resourceId });
        setOptimisticSlug(null);
      }
    } catch (err) {
      toastManager.add({
        type: "error",
        title: next ? "Couldn't share" : "Couldn't unshare",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const url = slug
    ? `${typeof window === "undefined" ? "" : window.location.origin}/share/${slug}`
    : "";

  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="end"
          anchor={anchor}
          className="isolate z-110"
          side="bottom"
          sideOffset={6}
        >
          <PopoverPrimitive.Popup
            className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 w-80 rounded-2xl border-[0.5px] bg-ui-bg-base p-3 text-ui-fg-base shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in"
            data-slot="popover-content"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-y-0.5">
                <Text className="font-medium" size="small">
                  Public access
                </Text>
                <Text className="text-ui-fg-subtle" size="xsmall">
                  Anyone with the link can view this resource.
                </Text>
              </div>
              <Switch
                checked={isShared}
                disabled={enabling || disabling}
                onCheckedChange={handleToggle}
              />
            </div>
            {isShared && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  className="txt-compact-small w-full truncate rounded-md border-[0.5px] bg-ui-bg-field px-2 py-1.5 text-ui-fg-base outline-none"
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  value={url}
                />
                <CopyButton className="size-8 shrink-0" text={url} />
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

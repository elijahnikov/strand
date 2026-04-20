import { useConvexMutation } from "@convex-dev/react-query";
import { RiCloseFill, RiDeleteBin6Line } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Button } from "@strand/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Separator } from "@strand/ui/separator";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLibrarySelection } from "~/lib/selection/library-selection";

export function TrashDock({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { clear, count, selectedResourceIds } = useLibrarySelection();

  if (count === 0) {
    return (
      <AnimatePresence>
        {/* placeholder so exit animations still fire */}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-24 left-1/2 z-50 flex h-10 -translate-x-1/2 items-center gap-x-1 rounded-lg border-[0.5px] bg-ui-bg-component p-1.5 pl-1"
        exit={{ opacity: 0, y: 8 }}
        initial={{ opacity: 0, y: 8 }}
        key="trash-dock"
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        <Badge
          className="mx-1 mr-0 rounded-sm px-2 py-0.25"
          variant={"secondary"}
        >
          <Text className="py-0.5 font-medium font-mono text-ui-fg-base text-xs">
            {count} selected
          </Text>
        </Badge>
        <Separator aria-hidden className="mx-1 h-4" orientation="vertical" />
        <RestoreButton
          onDone={clear}
          resourceIds={selectedResourceIds}
          workspaceId={workspaceId}
        />
        <PurgeButton
          onDone={clear}
          resourceIds={selectedResourceIds}
          workspaceId={workspaceId}
        />
        <Separator aria-hidden className="mx-1 h-4" orientation="vertical" />
        <Button
          aria-label="Clear selection"
          className="size-6 rounded-md"
          onClick={clear}
          size="small"
          variant="ghost"
        >
          <RiCloseFill className="size-4 shrink-0" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

function RestoreButton({
  workspaceId,
  resourceIds,
  onDone,
}: {
  onDone: () => void;
  resourceIds: Id<"resource">[];
  workspaceId: Id<"workspace">;
}) {
  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
    meta: { customErrorToast: true },
  });

  const handleClick = () => {
    mutate(
      { workspaceId, resourceIds },
      {
        onSuccess: () => {
          toastManager.add({
            type: "success",
            title:
              resourceIds.length === 1
                ? "Restored 1 resource"
                : `Restored ${resourceIds.length} resources`,
          });
          onDone();
        },
        onError: (err) => {
          toastManager.add({
            type: "error",
            title: "Could not restore",
            description: err instanceof Error ? err.message : String(err),
          });
        },
      }
    );
  };

  return (
    <Button
      className="h-7 gap-x-1.5 rounded-md px-2 text-xs"
      disabled={isPending}
      onClick={handleClick}
      size="small"
      variant="ghost"
    >
      <RotateCcwIcon className="size-3.5 shrink-0" />
      Restore
    </Button>
  );
}

function PurgeButton({
  workspaceId,
  resourceIds,
  onDone,
}: {
  onDone: () => void;
  resourceIds: Id<"resource">[];
  workspaceId: Id<"workspace">;
}) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.purgeMany),
    meta: { customErrorToast: true },
  });

  const handleConfirm = () => {
    mutate(
      { workspaceId, resourceIds },
      {
        onSuccess: () => {
          toastManager.add({
            type: "success",
            title:
              resourceIds.length === 1
                ? "Deleted 1 resource permanently"
                : `Deleted ${resourceIds.length} resources permanently`,
          });
          setOpen(false);
          onDone();
        },
        onError: (err) => {
          toastManager.add({
            type: "error",
            title: "Could not delete",
            description: err instanceof Error ? err.message : String(err),
          });
        },
      }
    );
  };

  return (
    <>
      <Button
        className="h-7 gap-x-1.5 rounded-md px-2 text-ui-fg-error text-xs hover:text-ui-fg-error"
        onClick={() => setOpen(true)}
        size="small"
        variant="ghost"
      >
        <RiDeleteBin6Line className="size-3.5 shrink-0" />
        Delete permanently
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="max-w-sm!">
          <DialogHeader>
            <div>
              <DialogTitle>Delete permanently?</DialogTitle>
              <DialogDescription>
                {resourceIds.length === 1
                  ? "This resource will be removed forever. This cannot be undone."
                  : `${resourceIds.length} resources will be removed forever. This cannot be undone.`}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              size="small"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleConfirm}
              size="small"
              variant="destructive"
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

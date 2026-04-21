import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@omi/ui/dialog";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { RiDeleteBin6Line } from "@remixicon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageContent } from "~/components/common/page-content";
import { LibrarySelectionProvider } from "~/lib/selection/library-selection";
import { TrashDock } from "./trash-dock";
import { TrashList } from "./trash-list";

export function TrashPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { data: firstPage } = useQuery(
    convexQuery(api.resource.queries.listTrashed, {
      workspaceId,
      paginationOpts: { numItems: 1, cursor: null },
    })
  );
  const hasAny = (firstPage?.page.length ?? 0) > 0;

  return (
    <LibrarySelectionProvider>
      <PageContent className="pt-14 pb-4 md:pt-4" width="xl:w-2/3">
        <div className="flex items-center justify-between py-4">
          <Heading>Trash</Heading>
          <DeleteAllButton disabled={!hasAny} workspaceId={workspaceId} />
        </div>
        <TrashList workspaceId={workspaceId} />
      </PageContent>
      <TrashDock workspaceId={workspaceId} />
    </LibrarySelectionProvider>
  );
}

function DeleteAllButton({
  workspaceId,
  disabled,
}: {
  disabled: boolean;
  workspaceId: Id<"workspace">;
}) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.purgeAllTrashed),
    meta: { customErrorToast: true },
  });

  const handleConfirm = () => {
    mutate(
      { workspaceId },
      {
        onSuccess: () => {
          toastManager.add({
            type: "success",
            title: "Trash emptied",
          });
          setOpen(false);
        },
        onError: (err) => {
          toastManager.add({
            type: "error",
            title: "Could not empty trash",
            description: err instanceof Error ? err.message : String(err),
          });
        },
      }
    );
  };

  return (
    <>
      <Button
        disabled={disabled || isPending}
        onClick={() => setOpen(true)}
        size="small"
        variant="destructive"
      >
        <RiDeleteBin6Line className="size-3.5 shrink-0" />
        Delete all
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="max-w-sm!">
          <DialogHeader>
            <div>
              <DialogTitle className="font-medium text-sm">
                Empty trash?
              </DialogTitle>
            </div>
          </DialogHeader>
          <Text className="p-3">
            Every item in the trash will be removed forever. This cannot be
            undone.
          </Text>
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
              Delete all
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

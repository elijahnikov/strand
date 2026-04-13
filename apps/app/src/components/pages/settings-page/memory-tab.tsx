import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Heading } from "@strand/ui/heading";
import { LoadingButton } from "@strand/ui/loading-button";
import { Text } from "@strand/ui/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Streamdown } from "streamdown";

export function MemoryTab({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { data } = useQuery(
    convexQuery(api.userMemory.queries.getMyMemory, { workspaceId })
  );

  const [confirmClear, setConfirmClear] = useState(false);

  const { mutate: clearMemory, isPending: isClearing } = useMutation({
    mutationFn: useConvexMutation(api.userMemory.mutations.clearMemory),
    onSuccess: () => setConfirmClear(false),
  });

  const hasContent = Boolean(data?.content?.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Heading>Memory</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          A short profile the assistant builds from your chats. It is included
          as context in every conversation in this workspace.
        </Text>
      </div>

      {hasContent ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Text className="text-ui-fg-muted" size="small">
              {data?.lastExtractedAt
                ? `Last updated ${formatDistanceToNow(data.lastExtractedAt, { addSuffix: true })}`
                : "Not yet updated"}
            </Text>
            <LoadingButton
              loading={false}
              onClick={() => setConfirmClear(true)}
              size="small"
              variant="secondary"
            >
              Clear memory
            </LoadingButton>
          </div>
          <div className="prose prose-sm max-w-none rounded-lg border bg-ui-bg-subtle p-4">
            <Streamdown>{data?.content ?? ""}</Streamdown>
          </div>
        </div>
      ) : (
        <div>
          <Text className="text-ui-fg-muted">
            No memory yet. As you chat, Strand will build a short profile here
            covering your active projects, recurring interests, and preferences.
          </Text>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmClear(false);
          }
        }}
        open={confirmClear}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Clear memory</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <DialogDescription>
              This will erase everything the assistant has remembered about you
              in this workspace. The profile will start rebuilding from future
              conversations.
            </DialogDescription>
          </div>
          <DialogFooter>
            <DialogClose
              render={<LoadingButton loading={false} variant="secondary" />}
            >
              Cancel
            </DialogClose>
            <LoadingButton
              loading={isClearing}
              onClick={() => clearMemory({ workspaceId })}
              variant="destructive"
            >
              Clear memory
            </LoadingButton>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

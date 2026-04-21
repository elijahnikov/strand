import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@omi/ui/dialog";
import { Heading } from "@omi/ui/heading";
import { Kbd } from "@omi/ui/kbd";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
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
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <Text className="font-mono text-ui-fg-muted" size="xsmall">
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
          <div className="max-w-none rounded-lg border bg-ui-bg-subtle p-4">
            <Streamdown
              components={{
                h1: ({ children }) => (
                  <Text
                    as="div"
                    className="mt-3 mb-1 font-semibold"
                    size="small"
                  >
                    {children}
                  </Text>
                ),
                h2: ({ children }) => (
                  <Text
                    as="div"
                    className="mt-3 mb-1 font-semibold"
                    size="xsmall"
                  >
                    {children}
                  </Text>
                ),
                h3: ({ children }) => (
                  <Text
                    as="div"
                    className="mt-2 mb-1 font-semibold"
                    size="xsmall"
                  >
                    {children}
                  </Text>
                ),
                h4: ({ children }) => (
                  <Text
                    as="div"
                    className="mt-2 mb-1 font-semibold"
                    size="xsmall"
                  >
                    {children}
                  </Text>
                ),
                p: ({ children }) => (
                  <Text as="p" className="mb-2" size="xsmall">
                    {children}
                  </Text>
                ),
                ul: ({ children }) => (
                  <ul className="txt-xsmall mb-2 list-disc space-y-0.5 pl-5">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="txt-xsmall mb-2 list-decimal space-y-0.5 pl-5">
                    {children}
                  </ol>
                ),
                li: ({ children }) => {
                  const isEmpty =
                    children === undefined ||
                    children === null ||
                    children === "" ||
                    (typeof children === "string" && children.trim() === "");
                  if (isEmpty) {
                    return null;
                  }
                  return (
                    <li className="txt-xsmall marker:text-ui-fg-muted">
                      {children}
                    </li>
                  );
                },
                strong: ({ children }) => (
                  <span className="font-semibold">{children}</span>
                ),
                em: ({ children }) => (
                  <span className="italic">{children}</span>
                ),
                a: ({ children, href }) => (
                  <a
                    className="text-ui-fg-base underline underline-offset-2"
                    href={href}
                    rel="noopener"
                    target="_blank"
                  >
                    {children}
                  </a>
                ),
                inlineCode: ({ children }) => <Kbd>{children}</Kbd>,
                blockquote: ({ children }) => (
                  <blockquote className="txt-xsmall mb-2 border-ui-border-base border-l-2 pl-3 text-ui-fg-subtle">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-3 border-ui-border-base" />,
              }}
            >
              {data?.content ?? ""}
            </Streamdown>
          </div>
        </div>
      ) : (
        <div>
          <Text className="text-ui-fg-muted">
            No memory yet. As you chat, omi will build a short profile here
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

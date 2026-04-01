import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Heading } from "@strand/ui/heading";
import { Kbd } from "@strand/ui/kbd";
import { Skeleton } from "@strand/ui/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";
import { ResourceRow, UploadingFileRow } from "./resource-row";

export function ResourceList({
  workspaceId,
  uploadingFiles,
}: {
  uploadingFiles: { id: string; name: string }[];
  workspaceId: Id<"workspace">;
}) {
  const { data: resources } = useSuspenseQuery(
    convexQuery(api.resource.queries.list, { workspaceId })
  );

  const updateTitle = useConvexMutation(api.resource.mutations.updateTitle);

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );

  if (resources.length === 0 && uploadingFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Heading className="font-medium text-sm text-ui-fg-subtle">
          No resources yet. Paste a URL, text, or file to get started.
        </Heading>
        <p className="mt-1 text-ui-fg-muted text-xs">
          Press <Kbd>Ctrl+V</Kbd> or <Kbd>⌘V</Kbd> anywhere on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <AnimatePresence mode="popLayout">
        {uploadingFiles.map((file) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, y: 8 }}
            key={file.id}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <UploadingFileRow fileName={file.name} />
          </motion.div>
        ))}
        {resources.map((resource, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, y: 8 }}
            key={resource._id}
            layout
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 35,
              delay: i * 0.03,
            }}
          >
            <ResourceRow
              onUpdateTitle={handleUpdateTitle}
              resource={resource}
              workspaceId={workspaceId}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ResourceListSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton className="h-11 w-full" key={i} />
      ))}
    </div>
  );
}

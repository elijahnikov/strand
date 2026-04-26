import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { CollapsibleSection } from "~/components/common/collapsible-section";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";

const RECENT_LIMIT = 8;

export function RecentResources({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { data: resources } = useQuery(
    convexQuery(api.resource.queries.listRecent, {
      workspaceId,
      limit: RECENT_LIMIT,
    })
  );

  const navigate = useNavigate();

  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });
  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });
  const { mutate: removeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });
  const { mutate: restoreMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
  });

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );

  const handleTogglePin = useCallback(
    (resourceId: Id<"resource">) => {
      togglePin({ resourceId, workspaceId });
    },
    [togglePin, workspaceId]
  );

  const handleDelete = useCallback(
    (resourceId: Id<"resource">) => {
      removeMany({ workspaceId, resourceIds: [resourceId] });
      const { nextUrl } = closeResourceTabs(workspaceId, [resourceId]);
      if (nextUrl) {
        navigate({ to: nextUrl });
      }
      toastManager.add({
        type: "success",
        title: "Deleted",
        actionProps: {
          children: "Undo",
          onClick: () => {
            restoreMany({ workspaceId, resourceIds: [resourceId] });
          },
        },
      });
    },
    [removeMany, restoreMany, workspaceId, navigate]
  );

  if (!resources?.length) {
    return null;
  }

  return (
    <CollapsibleSection
      className="mb-14"
      secondary={
        <Link
          onClick={(e) => e.stopPropagation()}
          params={{ workspaceId }}
          to="/workspace/$workspaceId/library"
        >
          <Button
            className="text-ui-fg-subtle text-xs hover:text-ui-fg-base"
            size="xsmall"
            variant="ghost"
          >
            View library
          </Button>
        </Link>
      }
      title="Recent"
    >
      <div className="mt-3 flex flex-col gap-y-1">
        {resources.map((r) => (
          <ResourceRow
            isPinned={false}
            key={r._id}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
            onUpdateTitle={handleUpdateTitle}
            resource={r}
            workspaceId={workspaceId}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

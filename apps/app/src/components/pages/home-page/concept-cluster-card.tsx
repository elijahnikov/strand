import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { toastManager } from "@omi/ui/toast";
import { RiArrowRightUpLine } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";

type SampleResource = Parameters<typeof ResourceRow>[0]["resource"];

export interface ConceptCluster {
  conceptId: Id<"concept">;
  name: string;
  resourceCount: number;
  sampleResources: SampleResource[];
}

function capitalize(s: string): string {
  if (!s) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSynthesisPrompt(name: string): string {
  return `What have I learned about ${name}? Synthesize across my saved resources, citing the strongest sources and noting any disagreements.`;
}

export function ConceptClusterCard({
  workspaceId,
  cluster,
}: {
  workspaceId: Id<"workspace">;
  cluster: ConceptCluster;
}) {
  const navigate = useNavigate();

  const handleSynthesize = () => {
    navigate({
      to: "/workspace/$workspaceId/chat",
      params: { workspaceId },
      search: { q: buildSynthesisPrompt(cluster.name) },
    });
  };

  const handleViewAll = () => {
    navigate({
      to: "/workspace/$workspaceId/search",
      params: { workspaceId },
      search: { concepts: cluster.conceptId },
    });
  };

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

  return (
    <div className="flex flex-col">
      <div className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate font-medium text-sm text-ui-fg-base">
            {capitalize(cluster.name)}
          </p>
          <p className="shrink-0 text-ui-fg-subtle text-xs">
            {cluster.resourceCount} resources
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button onClick={handleViewAll} size="xsmall" variant="secondary">
            View all
            <RiArrowRightUpLine className="size-3" />
          </Button>
          <Button onClick={handleSynthesize} size="xsmall" variant="secondary">
            Chat about this
            <RiArrowRightUpLine className="size-3" />
          </Button>
        </div>
      </div>
      {cluster.sampleResources.length > 0 ? (
        <div className="ml-4 flex flex-col gap-y-0.5 border-ui-border-base border-l pl-2">
          {cluster.sampleResources.map((r) => (
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
      ) : null}
    </div>
  );
}

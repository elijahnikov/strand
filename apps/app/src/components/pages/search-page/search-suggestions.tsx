import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Heading } from "@strand/ui/heading";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SparklesIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "~/components/common/collapsible-section";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import {
  clearRecent,
  loadRecent,
  type RecentSearch,
} from "~/lib/search/recent-searches";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";

export function SearchSuggestions({
  workspaceId,
  onPickRecent,
  onPickConcept,
}: {
  workspaceId: Id<"workspace">;
  onPickRecent: (recent: RecentSearch) => void;
  onPickConcept: (conceptId: Id<"concept">) => void;
}) {
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setRecent(loadRecent(workspaceId));
  }, [workspaceId]);

  const { data: topConcepts } = useQuery(
    convexQuery(api.search.queries.listTopConcepts, {
      workspaceId,
      limit: 12,
    })
  );

  const { data: stats } = useQuery(
    convexQuery(api.search.queries.workspaceStats, { workspaceId })
  );

  const { data: suggested } = useQuery(
    convexQuery(api.search.queries.getSuggestedForYou, {
      workspaceId,
      limit: 6,
    })
  );

  const { data: serverPinned } = useQuery(
    convexQuery(api.resource.queries.listPinned, { workspaceId })
  );
  const pinnedIdSet = useMemo(
    () => new Set((serverPinned ?? []).map((r) => r._id)),
    [serverPinned]
  );

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
  const navigate = useNavigate();

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

  const showFallbackBanner =
    stats && !stats.embeddingReady && stats.hasResources;

  return (
    <div className="flex flex-col gap-y-10 pt-6">
      {showFallbackBanner ? (
        <div className="rounded-lg border-[0.5px] bg-ui-bg-component px-4 py-3 text-ui-fg-subtle text-xs">
          <SparklesIcon className="mr-1.5 inline size-3.5 align-text-top" />
          AI-enhanced results unlock once your library finishes processing.
          Title search is active now.
        </div>
      ) : null}

      {recent.length > 0 ? (
        <CollapsibleSection
          secondary={
            <button
              aria-label="Clear recent searches"
              className="ml-2 flex size-5 items-center justify-center rounded-full text-ui-fg-muted hover:bg-ui-bg-component hover:text-ui-fg-base"
              onClick={(e) => {
                e.stopPropagation();
                clearRecent(workspaceId);
                setRecent([]);
              }}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          }
          title="Recent searches"
        >
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recent.map((item) => (
              <button
                className="group"
                key={`${item.q}-${item.at}`}
                onClick={() => onPickRecent(item)}
                type="button"
              >
                <Badge
                  className="h-7 cursor-pointer rounded-full px-3 text-xs transition-colors hover:bg-ui-bg-component"
                  variant="mono"
                >
                  {item.q}
                </Badge>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {topConcepts && topConcepts.length > 0 ? (
        <CollapsibleSection title="Top concepts in your workspace">
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topConcepts.map((concept) => (
              <button
                className="group"
                key={concept._id}
                onClick={() => onPickConcept(concept._id)}
                type="button"
              >
                <Badge
                  className="h-7 cursor-pointer rounded-full px-3 text-xs transition-colors hover:bg-ui-bg-component"
                  variant="mono"
                >
                  {concept.name}
                  <span className="ml-1 font-mono text-[10px] text-ui-fg-muted">
                    {concept.count}
                  </span>
                </Badge>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {suggested && suggested.length > 0 ? (
        <CollapsibleSection title="Suggested for you">
          <Text className="mt-1 text-ui-fg-muted text-xs">
            Based on your active projects and interests.
          </Text>
          <div className="mt-3 flex flex-col">
            {suggested.map((item) => (
              <ResourceRow
                isPinned={pinnedIdSet.has(item.resource._id)}
                key={item.resource._id}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
                onUpdateTitle={handleUpdateTitle}
                resource={
                  item.resource as Parameters<typeof ResourceRow>[0]["resource"]
                }
                workspaceId={workspaceId}
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {stats &&
      !stats.hasResources &&
      recent.length === 0 &&
      (!topConcepts || topConcepts.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Heading className="font-medium text-sm text-ui-fg-subtle">
            Your library is empty.
          </Heading>
          <Text className="mt-1 text-ui-fg-muted text-xs">
            Add a few resources in the library, then come back here to search.
          </Text>
        </div>
      ) : null}
    </div>
  );
}

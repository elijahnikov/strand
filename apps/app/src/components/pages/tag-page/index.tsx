import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Heading } from "@strand/ui/heading";
import { Skeleton } from "@strand/ui/skeleton";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContent } from "~/components/common/page-content";
import { SelectionDock } from "~/components/common/selection-dock";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { SelectableRow } from "~/components/pages/library-page/selectable-resource-row";
import { CollapsibleSection } from "~/components/pages/resource-page/collapsible-section";
import {
  LibrarySelectionProvider,
  type SelectionItem,
  useSelectAllHotkey,
} from "~/lib/selection/library-selection";

export function TagPageComponent() {
  const { workspaceId, tagName } = useParams({
    from: "/_workspace/workspace/$workspaceId/tags/$tagName",
  });

  const { data: tag } = useSuspenseQuery(
    convexQuery(api.resource.queries.getTag, {
      workspaceId: workspaceId as Id<"workspace">,
      tagName,
    })
  );

  const { data: directResources } = useSuspenseQuery(
    convexQuery(api.resource.queries.listByTag, {
      workspaceId: workspaceId as Id<"workspace">,
      tagName,
    })
  );

  const semanticTagSearch = useAction(
    api.resource.tagActions.semanticTagSearch
  );
  const [semanticResources, setSemanticResources] = useState<
    Array<{ resource: Record<string, unknown>; score: number }>
  >([]);
  const [semanticLoaded, setSemanticLoaded] = useState(false);

  useEffect(() => {
    setSemanticLoaded(false);
    semanticTagSearch({
      workspaceId: workspaceId as Id<"workspace">,
      tagName,
    })
      .then(setSemanticResources)
      .catch(() => setSemanticResources([]))
      .finally(() => setSemanticLoaded(true));
  }, [workspaceId, tagName, semanticTagSearch]);

  const directIds = useMemo(
    () => new Set((directResources ?? []).map((r) => r._id)),
    [directResources]
  );

  const semanticOnly = useMemo(
    () =>
      semanticResources
        .filter((r) => {
          const resource = r.resource as { _id?: string };
          return resource._id && !directIds.has(resource._id as Id<"resource">);
        })
        .map((r) => r.resource),
    [semanticResources, directIds]
  );

  const { data: serverPinned } = useQuery(
    convexQuery(api.resource.queries.listPinned, {
      workspaceId: workspaceId as Id<"workspace">,
    })
  );

  const pinnedIdSet = useMemo(
    () => new Set((serverPinned ?? []).map((r) => r._id)),
    [serverPinned]
  );

  const queryClient = useQueryClient();
  const listByTagQueryKey = convexQuery(api.resource.queries.listByTag, {
    workspaceId: workspaceId as Id<"workspace">,
    tagName,
  }).queryKey;

  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });

  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({
        resourceId,
        title,
        workspaceId: workspaceId as Id<"workspace">,
      });
      queryClient.setQueryData(
        listByTagQueryKey,
        (prev: typeof directResources) =>
          prev?.map((r) => (r._id === resourceId ? { ...r, title } : r))
      );
      setSemanticResources((prev) =>
        prev.map((r) =>
          (r.resource as { _id?: string })._id === resourceId
            ? { ...r, resource: { ...r.resource, title } }
            : r
        )
      );
    },
    [updateTitle, workspaceId, queryClient, listByTagQueryKey]
  );

  const handleTogglePin = useCallback(
    (resourceId: Id<"resource">) => {
      togglePin({ resourceId, workspaceId: workspaceId as Id<"workspace"> });
    },
    [togglePin, workspaceId]
  );

  const allResources = useMemo(() => {
    const direct = directResources ?? [];
    const semantic = semanticOnly.map(
      (r) => r as Parameters<typeof ResourceRow>[0]["resource"]
    );
    return { direct, semantic };
  }, [directResources, semanticOnly]);

  const orderedItems = useMemo<SelectionItem[]>(() => {
    const items: SelectionItem[] = [];
    for (const r of allResources.direct) {
      items.push({ kind: "resource", id: r._id });
    }
    for (const r of allResources.semantic) {
      items.push({ kind: "resource", id: r._id });
    }
    return items;
  }, [allResources]);

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Heading className="font-medium text-sm text-ui-fg-subtle">
          Tag not found.
        </Heading>
      </div>
    );
  }

  return (
    <LibrarySelectionProvider>
      <SelectAllRegister items={orderedItems} />
      <PageContent className="mt-12 py-8" width="xl:w-2/3">
        <div className="flex items-center gap-3">
          <div>
            <Heading>
              <span className="text-ui-fg-muted/50">#</span>
              {tag.name}
            </Heading>
          </div>
        </div>

        <div className="mt-12">
          <CollapsibleSection
            id="tag-tagged"
            secondary={
              allResources.direct.length > 0 ? (
                <Badge className="font-mono" size="sm" variant="outline">
                  {allResources.direct.length}
                </Badge>
              ) : undefined
            }
            title="Tagged"
          >
            {allResources.direct.length > 0 ? (
              <div className="mt-2 flex flex-col">
                {allResources.direct.map((resource, i) => (
                  <SelectableRow
                    item={{ kind: "resource", id: resource._id }}
                    key={resource._id}
                    orderedItems={orderedItems}
                  >
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 8 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                        delay: i * 0.03,
                      }}
                    >
                      <ResourceRow
                        isPinned={pinnedIdSet.has(resource._id)}
                        onTogglePin={handleTogglePin}
                        onUpdateTitle={handleUpdateTitle}
                        resource={resource}
                        workspaceId={workspaceId as Id<"workspace">}
                      />
                    </motion.div>
                  </SelectableRow>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-ui-fg-muted text-xs">
                No resources with this tag yet.
              </p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            className="mt-12"
            id="tag-related"
            secondary={
              semanticLoaded && allResources.semantic.length > 0 ? (
                <Badge className="font-mono" size="sm" variant="outline">
                  {allResources.semantic.length}
                </Badge>
              ) : undefined
            }
            title="Related"
          >
            <AnimatePresence mode="wait">
              {semanticLoaded ? (
                allResources.semantic.length > 0 ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex flex-col"
                    initial={{ opacity: 0, y: 4 }}
                    key="semantic-results"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {allResources.semantic.map((resource, i) => (
                      <SelectableRow
                        item={{ kind: "resource", id: resource._id }}
                        key={resource._id}
                        orderedItems={orderedItems}
                      >
                        <motion.div
                          animate={{ opacity: 1, y: 0 }}
                          initial={{ opacity: 0, y: 8 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 35,
                            delay: i * 0.03,
                          }}
                        >
                          <ResourceRow
                            isPinned={pinnedIdSet.has(resource._id)}
                            onTogglePin={handleTogglePin}
                            onUpdateTitle={handleUpdateTitle}
                            resource={resource}
                            workspaceId={workspaceId as Id<"workspace">}
                          />
                        </motion.div>
                      </SelectableRow>
                    ))}
                  </motion.div>
                ) : (
                  <motion.p
                    animate={{ opacity: 1 }}
                    className="mt-2 text-ui-fg-muted text-xs"
                    initial={{ opacity: 0 }}
                    key="semantic-empty"
                  >
                    No semantically related resources found.
                  </motion.p>
                )
              ) : (
                <motion.div
                  className="mt-2 flex flex-col gap-y-2"
                  exit={{ opacity: 0 }}
                  key="semantic-loading"
                  transition={{ duration: 0.15 }}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      className="h-11 w-full"
                      key={`skeleton-${i.toString()}`}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleSection>
        </div>
      </PageContent>
      <SelectionDock workspaceId={workspaceId as Id<"workspace">} />
    </LibrarySelectionProvider>
  );
}

function SelectAllRegister({ items }: { items: SelectionItem[] }) {
  useSelectAllHotkey(items);
  return null;
}

import { useConvexPaginatedQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Heading } from "@strand/ui/heading";
import { Skeleton } from "@strand/ui/skeleton";
import { Text } from "@strand/ui/text";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { PageContent } from "~/components/common/page-content";
import { TagsToolbar, useTagsFilters } from "./tags-toolbar";

const PAGE_SIZE = 30;

export function TagsPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { search, order } = useTagsFilters();

  const { results, status, loadMore } = useConvexPaginatedQuery(
    api.resource.queries.listWorkspaceTags,
    {
      workspaceId,
      search: search || undefined,
      order: order ?? undefined,
    },
    { initialNumItems: PAGE_SIZE }
  );

  const sorted = useMemo(() => {
    if (search) {
      return results;
    }
    if (order === "newest") {
      return [...results].sort((a, b) => b._creationTime - a._creationTime);
    }
    if (order === "oldest") {
      return [...results].sort((a, b) => a._creationTime - b._creationTime);
    }
    if (order === "most_resources") {
      return [...results].sort((a, b) => b.resourceCount - a.resourceCount);
    }
    return [...results].sort((a, b) => a.name.localeCompare(b.name));
  }, [results, order, search]);

  const { ref: loadMoreRef, inView } = useInView();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (results.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
    }
  }, [results.length]);

  useEffect(() => {
    if (inView && status === "CanLoadMore") {
      loadMore(PAGE_SIZE);
    }
  }, [inView, status, loadMore]);

  const isFirstLoad = status === "LoadingFirstPage" && results.length === 0;
  const isEmpty = sorted.length === 0 && !isFirstLoad;

  return (
    <div>
      <TagsToolbar />
      <PageContent className="pt-14 pb-4 md:pt-4" width="xl:w-2/3">
        {isFirstLoad ? (
          <TagsListSkeleton />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Heading className="font-medium text-sm text-ui-fg-subtle">
              {search
                ? "No tags found."
                : "No tags yet. Tags are created when you add them to resources."}
            </Heading>
          </div>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence>
              {sorted.map((tag, i) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  initial={
                    initialLoadDone.current ? false : { opacity: 0, y: 8 }
                  }
                  key={tag._id}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                    delay: initialLoadDone.current ? 0 : i * 0.03,
                  }}
                >
                  <Link
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-ui-bg-base-hover"
                    params={{ workspaceId, tagName: tag.name }}
                    to="/workspace/$workspaceId/tags/$tagName"
                  >
                    <Text className="text-ui-fg-muted">#</Text>
                    <Text className="flex-1 truncate font-medium text-ui-fg-base">
                      {tag.name}
                    </Text>
                    <Badge size="sm" variant={"mono"}>
                      {tag.resourceCount}
                    </Badge>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="h-px" ref={loadMoreRef} />
            {status === "LoadingMore" && <LoadingMoreSkeleton />}
          </div>
        )}
      </PageContent>
    </div>
  );
}

function TagsListSkeleton() {
  return (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton className="h-10 w-full" key={i} />
      ))}
    </div>
  );
}

function LoadingMoreSkeleton() {
  return (
    <div className="flex flex-col gap-y-2 py-2">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <Skeleton className="h-10 w-full" key={`loading-${i.toString()}`} />
      ))}
    </div>
  );
}

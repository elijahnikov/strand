import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Skeleton } from "@omi/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GetResourceData } from "~/lib/convex-types";

interface TagData {
  _id: Id<"tag">;
  color?: string;
  name: string;
}

export function ResourceTags({
  resourceId,
  tags,
  aiStatus,
}: {
  resourceId: Id<"resource">;
  tags: TagData[];
  aiStatus?: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const { workspaceId } = useParams({
    from: "/_workspace/workspace/$workspaceId/resource/$resourceId",
  });

  const queryClient = useQueryClient();
  const queryKey = convexQuery(api.resource.queries.get, {
    workspaceId: workspaceId as Id<"workspace">,
    resourceId,
  }).queryKey;

  const addTagMutationFn = useConvexMutation(api.resource.mutations.addTag);
  // const removeTagMutationFn = useConvexMutation(
  //   api.resource.mutations.removeTag
  // );

  const { mutate: addTag } = useMutation({
    mutationFn: addTagMutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<GetResourceData>(queryKey);
      if (previous) {
        const normalized = variables.name.trim().toLowerCase();
        queryClient.setQueryData<GetResourceData>(queryKey, {
          ...previous,
          tags: [
            ...previous.tags,
            { _id: `optimistic_${normalized}` as Id<"tag">, name: normalized },
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  // const { mutate: removeTag } = useMutation({
  //   mutationFn: removeTagMutationFn,
  //   onMutate: async (variables) => {
  //     await queryClient.cancelQueries({ queryKey });
  //     const previous = queryClient.getQueryData<GetResourceData>(queryKey);
  //     if (previous) {
  //       queryClient.setQueryData<GetResourceData>(queryKey, {
  //         ...previous,
  //         tags: previous.tags.filter((t) => t._id !== variables.tagId),
  //       });
  //     }
  //     return { previous };
  //   },
  //   onError: (_err, _variables, context) => {
  //     if (context?.previous) {
  //       queryClient.setQueryData(queryKey, context.previous);
  //     }
  //   },
  // });

  const handleAddTag = () => {
    const name = inputValue.trim();
    if (name.length === 0) {
      return;
    }
    addTag({
      resourceId,
      name,
      workspaceId: workspaceId as Id<"workspace">,
    });
    setInputValue("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddTag();
    }
    if (e.key === "Escape") {
      setInputValue("");
      setIsAdding(false);
    }
  };

  const isAiProcessing =
    (aiStatus === "pending" || aiStatus === "processing") && tags.length === 0;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <AnimatePresence mode="wait">
        {isAiProcessing ? (
          <motion.div
            className="flex gap-1.5"
            exit={{ opacity: 0 }}
            key="skeleton"
            transition={{ duration: 0.15 }}
          >
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-1.5"
            initial={{ opacity: 0, y: 4 }}
            key="tags"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {tags.map((tag) => (
              <Link
                key={tag._id}
                params={{ tagName: tag.name, workspaceId }}
                preload="intent"
                to="/workspace/$workspaceId/tags/$tagName"
              >
                <Badge
                  className="group flex items-center gap-x-0.5 text-xs"
                  variant="mono"
                >
                  <span className="text-ui-fg-muted">#</span>
                  {tag.name}
                </Badge>
              </Link>
            ))}
            {isAdding ? (
              <input
                autoFocus
                className="h-5 w-24 rounded-sm border border-ui-border-base bg-transparent px-1.5 font-mono text-xs outline-none focus:border-ui-border-interactive"
                onBlur={() => {
                  setInputValue("");
                  setIsAdding(false);
                }}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="tag name"
                value={inputValue}
              />
            ) : (
              <button
                className="flex h-5 items-center gap-0.5 rounded-sm border border-ui-border-base border-dashed px-1.5 font-mono text-ui-fg-subtle text-xs transition-colors hover:border-ui-border-interactive hover:text-ui-fg-base"
                onClick={() => setIsAdding(true)}
                type="button"
              >
                <PlusIcon className="h-3 w-3" />
                tag
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

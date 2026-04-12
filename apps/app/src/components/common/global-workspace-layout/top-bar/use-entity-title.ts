import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";

export function useResourceTitle(
  workspaceId: Id<"workspace"> | undefined,
  resourceId: Id<"resource"> | undefined
) {
  const { data } = useQuery(
    convexQuery(
      api.resource.queries.get,
      workspaceId && resourceId ? { workspaceId, resourceId } : "skip"
    )
  );
  return { title: data?.title, resource: data };
}

export function useChatThreadTitle(
  workspaceId: Id<"workspace"> | undefined,
  threadId: Id<"chatThread"> | undefined
) {
  const { data } = useQuery(
    convexQuery(
      api.chat.queries.getThread,
      workspaceId && threadId ? { workspaceId, threadId } : "skip"
    )
  );
  return { title: data?.title ?? undefined };
}

export function useCollectionTitle(
  workspaceId: Id<"workspace"> | undefined,
  collectionId: Id<"collection"> | undefined
) {
  const { data } = useQuery(
    convexQuery(
      api.collection.queries.get,
      workspaceId && collectionId ? { workspaceId, collectionId } : "skip"
    )
  );
  return { title: data?.name, icon: data?.icon };
}

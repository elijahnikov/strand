import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useLocation, useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  useChatThreadTitle,
  useCollectionTitle,
  useResourceTitle,
} from "~/components/common/global-workspace-layout/top-bar/use-entity-title";
import {
  type TabKind,
  useWorkspaceTabs,
  type WorkspaceTab,
} from "~/lib/workspace-tabs-store";

interface RouteEntity {
  entityId: string;
  fallbackTitle: string;
  id: string;
  kind: TabKind;
  url: string;
}

function detectEntity(
  params: {
    workspaceId?: string;
    resourceId?: string;
    threadId?: string;
    tagName?: string;
    collectionId?: string;
  },
  pathname: string
): RouteEntity | null {
  const { workspaceId } = params;
  if (!workspaceId) {
    return null;
  }
  const base = `/workspace/${workspaceId}`;

  if (params.resourceId) {
    return {
      kind: "resource",
      entityId: params.resourceId,
      url: `${base}/resource/${params.resourceId}`,
      id: `resource:${params.resourceId}`,
      fallbackTitle: "Loading…",
    };
  }

  if (params.threadId && pathname.startsWith(`${base}/chat/`)) {
    return {
      kind: "chat",
      entityId: params.threadId,
      url: `${base}/chat/${params.threadId}`,
      id: `chat:${params.threadId}`,
      fallbackTitle: "New chat",
    };
  }

  if (params.tagName && pathname.startsWith(`${base}/tags/`)) {
    return {
      kind: "tag",
      entityId: params.tagName,
      url: `${base}/tags/${params.tagName}`,
      id: `tag:${params.tagName}`,
      fallbackTitle: `#${params.tagName}`,
    };
  }

  if (params.collectionId) {
    return {
      kind: "collection",
      entityId: params.collectionId,
      url: `${base}/library/collection/${params.collectionId}`,
      id: `collection:${params.collectionId}`,
      fallbackTitle: "Collection",
    };
  }

  return null;
}

export function useRouteTabsSync() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
    resourceId?: string;
    threadId?: string;
    tagName?: string;
    collectionId?: string;
  };
  const pathname = useLocation({ select: (l) => l.pathname });

  const entity = useMemo(
    () => detectEntity(params, pathname),
    [params, pathname]
  );

  const openOrActivate = useWorkspaceTabs((s) => s.openOrActivate);
  const updateTitle = useWorkspaceTabs((s) => s.updateTitle);
  const clearActive = useWorkspaceTabs((s) => s.clearActive);

  const workspaceId = params.workspaceId;
  const resourceKind = entity?.kind === "resource" ? entity : null;
  const chatKind = entity?.kind === "chat" ? entity : null;
  const collectionKind = entity?.kind === "collection" ? entity : null;

  const { title: resourceTitle } = useResourceTitle(
    workspaceId as Id<"workspace"> | undefined,
    resourceKind?.entityId as Id<"resource"> | undefined
  );
  const { title: chatTitle } = useChatThreadTitle(
    workspaceId as Id<"workspace"> | undefined,
    chatKind?.entityId as Id<"chatThread"> | undefined
  );
  const { title: collectionTitle, icon: collectionIcon } = useCollectionTitle(
    workspaceId as Id<"workspace"> | undefined,
    collectionKind?.entityId as Id<"collection"> | undefined
  );

  // Register / activate tab when entity enters the route.
  useEffect(() => {
    if (!(workspaceId && entity)) {
      if (workspaceId) {
        clearActive(workspaceId);
      }
      return;
    }
    const tab: WorkspaceTab = {
      id: entity.id,
      kind: entity.kind,
      entityId: entity.entityId,
      url: entity.url,
      title: entity.fallbackTitle,
    };
    openOrActivate(workspaceId, tab);
  }, [workspaceId, entity, openOrActivate, clearActive]);

  // Keep the tab's title synced with its source of truth.
  useEffect(() => {
    if (!(workspaceId && entity)) {
      return;
    }
    let resolved: string | undefined;
    if (entity.kind === "resource") {
      resolved = resourceTitle;
    } else if (entity.kind === "chat") {
      resolved = chatTitle;
    } else if (entity.kind === "collection" && collectionTitle) {
      resolved = collectionIcon
        ? `${collectionIcon} ${collectionTitle}`
        : collectionTitle;
    } else if (entity.kind === "tag") {
      resolved = `#${entity.entityId}`;
    }
    if (resolved && resolved.trim().length > 0) {
      updateTitle(workspaceId, entity.id, resolved);
    }
  }, [
    workspaceId,
    entity,
    resourceTitle,
    chatTitle,
    collectionTitle,
    collectionIcon,
    updateTitle,
  ]);
}

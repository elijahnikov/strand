import type { Id } from "@omi/backend/_generated/dataModel.js";
import { ResourceTile, type ResourceTileData } from "./resource-tile";

function formatRelative(timestamp: number): string {
  const days = Math.max(
    1,
    Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000))
  );
  if (days < 60) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function ForgottenGemCard({
  workspaceId,
  resource,
}: {
  workspaceId: Id<"workspace">;
  resource: ResourceTileData;
}) {
  return (
    <ResourceTile
      footer={`Last touched ${formatRelative(resource.updatedAt)}`}
      resource={resource}
      workspaceId={workspaceId}
    />
  );
}

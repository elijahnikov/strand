import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { RiArrowRightSLine, RiLinksFill } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { HomeCard } from "./card";

export interface RecentConnection {
  linkId: Id<"resourceLink">;
  newer: { _id: Id<"resource">; title: string; type: string };
  older: {
    _id: Id<"resource">;
    title: string;
    type: string;
    updatedAt: number;
  };
  score: number;
  sharedConcepts: string[];
}

function formatRelative(timestamp: number, now: number): string {
  const days = Math.max(
    1,
    Math.floor((now - timestamp) / (24 * 60 * 60 * 1000))
  );
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function RecentConnectionCard({
  workspaceId,
  connection,
}: {
  workspaceId: Id<"workspace">;
  connection: RecentConnection;
}) {
  const olderRelative = formatRelative(connection.older.updatedAt, Date.now());

  return (
    <HomeCard>
      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ui-tag-blue-bg text-ui-tag-blue-text">
          <RiLinksFill className="size-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <ConnectionRow
            label="New"
            resource={connection.newer}
            workspaceId={workspaceId}
          />
          <div className="ml-1 flex items-center text-ui-fg-muted">
            <RiArrowRightSLine className="size-3 rotate-90" />
          </div>
          <ConnectionRow
            label={olderRelative}
            resource={connection.older}
            workspaceId={workspaceId}
          />
        </div>
      </div>
      {connection.sharedConcepts.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {connection.sharedConcepts.map((c) => (
            <span
              className="inline-flex items-center rounded-sm bg-ui-bg-subtle px-1.5 py-0.5 text-[11px] text-ui-fg-subtle"
              key={c}
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </HomeCard>
  );
}

function ConnectionRow({
  workspaceId,
  resource,
  label,
}: {
  workspaceId: Id<"workspace">;
  resource: { _id: Id<"resource">; title: string };
  label: string;
}) {
  return (
    <Link
      className={cn(
        "group/row flex items-center gap-2 rounded-sm transition-colors",
        "hover:bg-ui-bg-component-hover"
      )}
      params={{ workspaceId, resourceId: resource._id }}
      preload="intent"
      to="/workspace/$workspaceId/resource/$resourceId"
    >
      <span className="w-12 shrink-0 text-ui-fg-muted text-xs">{label}</span>
      <span className="line-clamp-1 flex-1 text-sm text-ui-fg-base group-hover/row:text-ui-fg-interactive">
        {resource.title}
      </span>
    </Link>
  );
}

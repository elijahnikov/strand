import { Badge } from "@omi/ui/badge";
import { Separator } from "@omi/ui/separator";
import { RiArrowRightUpLine } from "@remixicon/react";
import { format } from "date-fns";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { MiddleTruncate } from "~/components/common/middle-truncate";
import { UserAvatar } from "~/components/common/user-avatar";
import type { ShareResourceData } from "./types";

export function ShareHeader({ resource }: { resource: ShareResourceData }) {
  return (
    <div className="flex flex-col gap-y-1">
      <div className="relative flex w-full items-center">
        <h1 className="h1-core font-medium font-sans">{resource.title}</h1>
      </div>
      <div className="flex w-full min-w-0 items-center gap-x-2">
        <TypeBadge resource={resource} />
        {resource.type !== "note" && (
          <Separator className="h-4 shrink-0" orientation="vertical" />
        )}
        <Badge className="shrink-0 text-xs" variant="mono">
          {format(new Date(resource._creationTime), "d MMM yyyy HH:mm")}
        </Badge>
        <Separator className="h-4 shrink-0" orientation="vertical" />
        <Badge className="shrink-0 text-xs" variant="mono">
          <UserAvatar
            className="size-3.5"
            image={resource.createdBy.image}
            name={resource.createdBy.username}
            size={14}
          />
          {resource.createdBy.username}
        </Badge>
      </div>
    </div>
  );
}

function TypeBadge({ resource }: { resource: ShareResourceData }) {
  if (resource.type === "website" && resource.website) {
    const website = resource.website;
    return (
      <a
        className="flex min-w-0 max-w-[420px]"
        href={website.url}
        rel="noopener"
        target="_blank"
      >
        <Badge
          className="min-w-0 max-w-full text-ui-fg-subtle text-xs"
          variant="mono"
        >
          {website.favicon && (
            <img
              alt={website.url}
              className="shrink-0 rounded-[4px]"
              height={14}
              src={website.favicon}
              width={14}
            />
          )}
          <span className="shrink-0 font-medium text-ui-fg-base">
            {website.domain ?? new URL(website.url).hostname}
          </span>
          <span className="-ml-1 inline-block min-w-0 flex-1">
            <MiddleTruncate text={new URL(website.url).pathname} />
          </span>
          <RiArrowRightUpLine className="shrink-0" />
        </Badge>
      </a>
    );
  }
  if (resource.type === "file" && resource.file) {
    const file = resource.file;
    return (
      <Badge className="min-w-0 max-w-[460px] text-xs" variant="mono">
        <FileKindIcon
          className="h-3.5 w-3.5 shrink-0"
          fileName={file.fileName}
          mimeType={file.mimeType}
        />
        <span className="min-w-0 flex-1">
          <MiddleTruncate text={file.fileName} />
        </span>
      </Badge>
    );
  }
  return null;
}

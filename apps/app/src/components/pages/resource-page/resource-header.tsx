import { Avatar, AvatarFallback, AvatarImage } from "@strand/ui/avatar";
import { Badge } from "@strand/ui/badge";
import { Heading } from "@strand/ui/heading";
import { Separator } from "@strand/ui/separator";
import { format } from "date-fns";
import { FileIcon } from "lucide-react";
import type { GetResourceData } from "~/lib/convex-types";

export function ResourceHeader({ resource }: { resource: GetResourceData }) {
  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex w-full items-center">
        <Heading>{resource.title}</Heading>
      </div>
      <div className="flex items-center gap-x-2">
        <TypeBadge resource={resource} />
        <Separator
          className="relative -top-0.5 mt-1.5 mb-0.5"
          orientation="vertical"
        />
        <Badge
          className="px-1 font-mono shadow-borders-base"
          variant="secondary"
        >
          {format(new Date(resource._creationTime), "d MMM yyyy HH:mm")}
        </Badge>
        <Separator
          className="relative -top-0.5 mt-1.5 mb-0.5"
          orientation="vertical"
        />
        <Badge
          className="px-1 font-mono shadow-borders-base"
          variant="secondary"
        >
          <Avatar className="size-3.5">
            <AvatarImage
              alt={resource.createdBy?.username}
              src={resource.createdBy?.image}
            />
            <AvatarFallback>
              {resource.createdBy?.username.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {resource.createdBy?.username}
        </Badge>
      </div>
    </div>
  );
}

function TypeBadge({ resource }: { resource: GetResourceData }) {
  switch (resource.type) {
    case "website": {
      const website = "website" in resource ? resource.website : null;
      if (!website) {
        return null;
      }
      return (
        <a href={website.url} rel="noopener" target="_blank">
          <Badge
            className="mt-1 px-1 font-mono text-ui-fg-subtle shadow-borders-base"
            variant="secondary"
          >
            <img
              alt={website.url}
              className="rounded-[4px]"
              height={14}
              src={website.favicon}
              width={14}
            />
            <span className="text-ui-fg-base">
              {new URL(website.url).hostname}
            </span>
            <span className="-ml-1">{new URL(website.url).pathname}</span>
          </Badge>
        </a>
      );
    }
    case "file": {
      const file = "file" in resource ? resource.file : null;
      if (!file) {
        return null;
      }
      return (
        <Badge
          className="mt-1 px-1 font-mono text-ui-fg-subtle shadow-borders-base"
          variant="secondary"
        >
          <FileIcon className="h-3.5 w-3.5" />
          <span>{file.fileName}</span>
        </Badge>
      );
    }
    default:
      return null;
  }
}

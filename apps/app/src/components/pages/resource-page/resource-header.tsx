import { Avatar, AvatarFallback, AvatarImage } from "@strand/ui/avatar";
import { Badge } from "@strand/ui/badge";
import { Heading } from "@strand/ui/heading";
import { Separator } from "@strand/ui/separator";
import { format } from "date-fns";
import { FileIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { MiddleTruncate } from "~/components/common/middle-truncate";
import type { GetResourceData } from "~/lib/convex-types";

export function ResourceHeader({ resource }: { resource: GetResourceData }) {
  const aiStatus = resource.resourceAI?.status;
  const isAiProcessing = aiStatus === "pending" || aiStatus === "processing";

  return (
    <div className="flex flex-col gap-y-1">
      <div className="relative flex w-full items-center">
        <AnimatePresence>
          {isAiProcessing && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -left-5"
              exit={{ opacity: 0, scale: 0.5 }}
              initial={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <DotGridLoader />
            </motion.div>
          )}
        </AnimatePresence>
        <Heading>{resource.title}</Heading>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TypeBadge resource={resource} />
        {resource.type !== "note" && (
          <Separator className="h-4" orientation="vertical" />
        )}
        <Badge variant="mono">
          {format(new Date(resource._creationTime), "d MMM yyyy HH:mm")}
        </Badge>
        <Separator className="h-4" orientation="vertical" />
        <Badge variant="mono">
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
        <a
          className="flex max-w-[420px]"
          href={website.url}
          rel="noopener"
          target="_blank"
        >
          <Badge className="max-w-full text-ui-fg-subtle" variant="mono">
            <img
              alt={website.url}
              className="shrink-0 rounded-[4px]"
              height={14}
              src={website.favicon}
              width={14}
            />
            <span className="shrink-0 font-medium text-ui-fg-base">
              {new URL(website.url).hostname}
            </span>
            <span className="-ml-1 min-w-0 flex-1">
              <MiddleTruncate text={new URL(website.url).pathname} />
            </span>
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
        <Badge className="max-w-[460px] text-ui-fg-subtle" variant="mono">
          <FileIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <MiddleTruncate text={file.fileName} />
          </span>
        </Badge>
      );
    }
    default:
      return null;
  }
}

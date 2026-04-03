import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { FileIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GetResourceData } from "~/lib/convex-types";
import { getFileLabel } from "~/lib/format";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

function FileImage({ alt, src }: { alt: string; src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return <FilePreviewEmpty />;
  }

  return (
    <AnimatePresence mode="wait">
      {loaded ? (
        <motion.img
          alt={alt}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-4 h-[300px] w-full rounded-xl object-cover"
          height="auto"
          initial={{ opacity: 0, y: 4 }}
          key="image"
          src={src}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          width="auto"
        />
      ) : (
        <motion.div
          exit={{ opacity: 0 }}
          key="loading"
          transition={{ duration: 0.15 }}
        >
          <Card className="mt-4 p-2 pb-0">
            <div className="relative h-[300px] w-full overflow-hidden rounded-lg">
              <FlickeringGrid
                className="absolute inset-0 z-0 size-full"
                color="#6B7280"
                flickerChance={0.1}
                gridGap={6}
                height={800}
                maxOpacity={0.5}
                squareSize={4}
                width={800}
              />
            </div>
          </Card>
          {/* Hidden img to trigger load/error */}
          <img
            alt={alt}
            className="hidden"
            onError={() => setError(true)}
            onLoad={() => setLoaded(true)}
            src={src}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilePreviewEmpty({ mimeType }: { mimeType?: string }) {
  return (
    <div className="mt-4 flex h-[200px] w-full items-center justify-center rounded-xl border border-ui-border-base bg-ui-bg-subtle">
      <div className="flex flex-col items-center gap-2 text-ui-fg-muted">
        <FileIcon className="h-8 w-8" />
        <span className="font-mono text-xs">{getFileLabel(mimeType)}</span>
      </div>
    </div>
  );
}

export function FileResource({ resource }: { resource: GetResourceData }) {
  const file = "file" in resource ? resource.file : null;
  const fileUrl =
    "fileUrl" in resource ? (resource.fileUrl as string | null) : null;
  const isImage = file?.mimeType?.startsWith("image/");

  return (
    <div className="mx-auto mt-2 w-[55%]">
      <ResourceHeader resource={resource} />
      {isImage && fileUrl ? (
        <FileImage alt={file?.fileName ?? resource.title} src={fileUrl} />
      ) : (
        <FilePreviewEmpty mimeType={file?.mimeType ?? undefined} />
      )}
      <ResourceTags
        aiStatus={resource.resourceAI?.status}
        resourceId={resource._id}
        tags={resource.tags}
      />
      <ResourceSummary resource={resource} />
      {"links" in resource && (
        <RelatedResources
          aiStatus={resource.resourceAI?.status}
          links={resource.links}
        />
      )}
    </div>
  );
}

import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { GlobeIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GetResourceData } from "~/lib/convex-types";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

function OgImage({ alt, src }: { alt: string; src: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return <OgImageEmpty />;
  }

  return (
    <img
      alt={alt}
      className="mx-auto mt-4 aspect-auto h-[300px] w-full rounded-xl object-cover"
      height="auto"
      onError={() => setError(true)}
      src={src}
      width="auto"
    />
  );
}

function OgImageEmpty() {
  return (
    <div className="mt-4 flex h-[200px] w-full items-center justify-center rounded-xl border border-ui-border-base bg-ui-bg-subtle">
      <div className="flex flex-col items-center gap-2 text-ui-fg-muted">
        <GlobeIcon className="h-8 w-8" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    </div>
  );
}

function WebsiteImage({
  website,
  title,
}: {
  website: { metadataStatus?: string; ogImage?: string | null };
  title: string;
}) {
  return (
    <AnimatePresence mode="wait">
      {website.metadataStatus === "processing" ? (
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
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 4 }}
          key="image"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {website.ogImage ? (
            <OgImage alt={title} src={website.ogImage} />
          ) : (
            <OgImageEmpty />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WebsiteResource({ resource }: { resource: GetResourceData }) {
  const website = "website" in resource ? resource.website : null;
  if (!website) {
    return null;
  }

  return (
    <div className="mx-auto mt-2 w-[55%]">
      <ResourceHeader resource={resource} />
      <WebsiteImage title={resource.title} website={website} />
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

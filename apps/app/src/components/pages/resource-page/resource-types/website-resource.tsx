import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import type { GetResourceData } from "~/lib/convex-types";
import { ResourceHeader } from "../resource-header";

export function WebsiteResource({ resource }: { resource: GetResourceData }) {
  const website = "website" in resource ? resource.website : null;
  if (!website) {
    return null;
  }

  return (
    <div className="mx-auto mt-2 w-1/2">
      <ResourceHeader resource={resource} />
      {website.metadataStatus === "processing" ? (
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
      ) : (
        website.ogImage && (
          <img
            alt={resource.title}
            className="mx-auto mt-4 aspect-auto h-[300px] w-full rounded-xl object-cover"
            height="auto"
            src={website.ogImage}
            width="auto"
          />
        )
      )}
    </div>
  );
}

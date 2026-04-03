import type { GetResourceData } from "~/lib/convex-types";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

export function NoteResource({ resource }: { resource: GetResourceData }) {
  return (
    <div className="mx-auto mt-2 w-1/2">
      <ResourceHeader resource={resource} />
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

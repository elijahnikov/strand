import { lazy, Suspense } from "react";
import type { GetResourceData } from "~/lib/convex-types";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

const NoteEditor = lazy(() => import("./note-editor"));

export function NoteResource({ resource }: { resource: GetResourceData }) {
  const content = "content" in resource ? resource.content : null;
  const note = "note" in resource ? resource.note : null;

  const jsonContent = content?.jsonContent ?? note?.jsonContent ?? undefined;
  const htmlContent = jsonContent
    ? undefined
    : (content?.htmlContent ?? note?.htmlContent ?? undefined);
  const plainTextContent =
    jsonContent || htmlContent
      ? undefined
      : (content?.plainTextContent ?? note?.plainTextContent ?? undefined);

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
      <Suspense fallback={<div className="mt-6 min-h-[100px]" />}>
        <NoteEditor
          htmlContent={htmlContent}
          jsonContent={jsonContent}
          key={resource._id}
          plainTextContent={plainTextContent}
          resourceId={resource._id}
        />
      </Suspense>
    </div>
  );
}

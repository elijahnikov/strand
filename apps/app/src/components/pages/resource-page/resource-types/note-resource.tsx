import { lazy, Suspense } from "react";
import { PageContent } from "~/components/common/page-content";
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

  return (
    <PageContent className="mt-2">
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
          initialContent={jsonContent}
          key={resource._id}
          resourceId={resource._id}
        />
      </Suspense>
    </PageContent>
  );
}

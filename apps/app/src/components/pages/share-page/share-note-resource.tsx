import { lazy, Suspense } from "react";
import { PageContent } from "~/components/common/page-content";
import { ShareHeader } from "./share-header";
import { ShareSummary } from "./share-summary";
import { ShareTags } from "./share-tags";
import type { ShareResourceData } from "./types";

const ShareNoteViewer = lazy(() => import("./share-note-viewer"));

export function ShareNoteResource({
  resource,
}: {
  resource: ShareResourceData;
}) {
  const note = resource.note;
  const content = resource.content;
  const jsonContent = content?.jsonContent ?? note?.jsonContent;
  const htmlContent = jsonContent ? undefined : note?.htmlContent;
  const plainTextContent = jsonContent ? undefined : note?.plainTextContent;

  return (
    <PageContent className="mt-2">
      <ShareHeader resource={resource} />
      <ShareTags tags={resource.tags} />
      <ShareSummary summary={resource.summary} />
      <Suspense fallback={<div className="mt-6 min-h-[100px]" />}>
        <ShareNoteViewer
          htmlContent={htmlContent}
          jsonContent={jsonContent}
          plainTextContent={plainTextContent}
        />
      </Suspense>
    </PageContent>
  );
}

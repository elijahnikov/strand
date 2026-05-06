import { lazy, Suspense } from "react";
import { PageContent } from "~/components/common/page-content";
import type { GetResourceData } from "~/lib/convex-types";
import { DailyNoteSavedToday } from "../daily-note-saved-today";
import { DailyNoteTodaysConcepts } from "../daily-note-todays-concepts";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

const NoteEditor = lazy(() => import("./note-editor"));

export function NoteResource({ resource }: { resource: GetResourceData }) {
  const content = "content" in resource ? resource.content : null;
  const note = "note" in resource ? resource.note : null;
  const jsonContent = content?.jsonContent ?? note?.jsonContent ?? undefined;
  const fallbackMarkdown = jsonContent
    ? undefined
    : (note?.plainTextContent ?? undefined);
  const fallbackHtml = jsonContent
    ? undefined
    : (note?.htmlContent ?? undefined);

  return (
    <PageContent className="mt-2">
      <ResourceHeader resource={resource} />

      <ResourceTags
        aiStatus={resource.resourceAI?.status}
        resourceId={resource._id}
        tags={resource.tags}
        workspaceId={resource.workspaceId}
      />
      {resource.dailyNoteDate && (
        <>
          <DailyNoteSavedToday
            date={resource.dailyNoteDate}
            workspaceId={resource.workspaceId}
          />
          <DailyNoteTodaysConcepts
            date={resource.dailyNoteDate}
            workspaceId={resource.workspaceId}
          />
        </>
      )}
      <ResourceSummary resource={resource} />
      {"links" in resource && (
        <RelatedResources
          aiStatus={resource.resourceAI?.status}
          links={resource.links}
          workspaceId={resource.workspaceId}
        />
      )}
      <Suspense fallback={<div className="mt-6 min-h-[100px]" />}>
        <NoteEditor
          fallbackHtml={fallbackHtml}
          fallbackMarkdown={fallbackMarkdown}
          initialContent={jsonContent}
          // Include syncedAt so a remote sync update remounts the editor with
          // fresh content, while local edits (which don't touch syncedAt)
          // don't disturb the user mid-typing.
          key={`${resource._id}:${"syncedAt" in resource ? (resource.syncedAt ?? 0) : 0}`}
          resourceId={resource._id}
          workspaceId={resource.workspaceId}
        />
      </Suspense>
    </PageContent>
  );
}

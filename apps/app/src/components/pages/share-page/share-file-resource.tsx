import { lazy, Suspense } from "react";
import { PageContent } from "~/components/common/page-content";
import { getFilePreviewKind } from "~/lib/format";
import { FilePreview } from "../resource-page/resource-types/file-resource";
import { ShareHeader } from "./share-header";
import { ShareSummary } from "./share-summary";
import { ShareTags } from "./share-tags";
import type { ShareResourceData } from "./types";

const ShareNoteViewer = lazy(() => import("./share-note-viewer"));

export function ShareFileResource({
  resource,
}: {
  resource: ShareResourceData;
}) {
  const file = resource.file ?? null;
  const fileUrl = file?.fileUrl ?? null;
  const kind = getFilePreviewKind(file?.mimeType, file?.fileName);

  const content = resource.content;
  const jsonContent = content?.jsonContent;
  const hasNote =
    jsonContent || content?.htmlContent || content?.plainTextContent;

  return (
    <PageContent className="mt-2">
      <ShareHeader resource={resource} />
      <FilePreview
        file={
          file
            ? {
                fileName: file.fileName,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
              }
            : null
        }
        fileUrl={fileUrl}
        kind={kind}
        title={resource.title}
      />
      <ShareTags tags={resource.tags} />
      <ShareSummary summary={resource.summary} />
      {hasNote && (
        <Suspense fallback={<div className="mt-6 min-h-[100px]" />}>
          <ShareNoteViewer
            htmlContent={jsonContent ? undefined : content?.htmlContent}
            jsonContent={jsonContent}
            plainTextContent={
              jsonContent ? undefined : content?.plainTextContent
            }
          />
        </Suspense>
      )}
    </PageContent>
  );
}

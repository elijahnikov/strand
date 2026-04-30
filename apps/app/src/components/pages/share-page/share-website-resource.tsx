import { lazy, Suspense } from "react";
import { PageContent } from "~/components/common/page-content";
import {
  LoadingPreview,
  WebsiteEmbed,
  WebsiteImage,
} from "../resource-page/resource-types/website-resource";
import { ShareHeader } from "./share-header";
import { ShareSummary } from "./share-summary";
import { ShareTags } from "./share-tags";
import type { ShareResourceData } from "./types";

const ShareNoteViewer = lazy(() => import("./share-note-viewer"));

export function ShareWebsiteResource({
  resource,
}: {
  resource: ShareResourceData;
}) {
  const website = resource.website;
  if (!website) {
    return null;
  }

  const renderPreview = () => {
    if (
      website.metadataStatus === "pending" ||
      website.metadataStatus === "processing"
    ) {
      return <LoadingPreview />;
    }
    if (website.isEmbeddable && website.embedType && website.embedId) {
      return (
        <WebsiteEmbed
          embedId={website.embedId}
          embedType={website.embedType}
          url={website.url}
        />
      );
    }
    return (
      <WebsiteImage
        title={resource.title}
        website={{
          metadataStatus: website.metadataStatus,
          ogImage: website.ogImage ?? null,
        }}
      />
    );
  };

  const content = resource.content;
  const jsonContent = content?.jsonContent;
  const hasNote =
    jsonContent || content?.htmlContent || content?.plainTextContent;

  return (
    <PageContent className="mt-2">
      <ShareHeader resource={resource} />
      {renderPreview()}
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

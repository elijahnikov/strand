import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { AnimatePresence, motion } from "motion/react";
import { lazy, Suspense, useState } from "react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { PageContent } from "~/components/common/page-content";

const NoteEditor = lazy(() => import("./note-editor"));

import type { GetResourceData } from "~/lib/convex-types";
import { getFileLabel, getFilePreviewKind } from "~/lib/format";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";
import { AudioPreview } from "./audio-preview";
import { CodePreview } from "./code-preview";
import { CsvPreview } from "./csv-preview";
import { ImagePreviewDialog, PdfPreviewDialog } from "./file-preview-dialog";
import { MarkdownPreview } from "./markdown-preview";
import { PdfPreview } from "./pdf-preview";
import { VideoPreview } from "./video-preview";

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
                maxOpacity={0.5}
                squareSize={4}
              />
            </div>
          </Card>

          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: <> */}
          <img
            alt={alt}
            className="hidden"
            height={10}
            onError={() => setError(true)}
            onLoad={() => setLoaded(true)}
            src={src}
            width={10}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilePreviewEmpty({
  fileName,
  mimeType,
}: {
  fileName?: string;
  mimeType?: string;
}) {
  return (
    <div className="mt-4 flex h-[200px] w-full items-center justify-center rounded-xl border border-ui-border-base bg-ui-bg-subtle">
      <div className="flex flex-col items-center gap-2 text-ui-fg-muted">
        <FileKindIcon
          className="h-8 w-8"
          fileName={fileName}
          mimeType={mimeType}
        />
        <span className="font-mono text-xs">{getFileLabel(mimeType)}</span>
      </div>
    </div>
  );
}

function FilePreview({
  kind,
  fileUrl,
  file,
  title,
}: {
  kind: ReturnType<typeof getFilePreviewKind>;
  fileUrl: string | null;
  file: { fileName: string; fileSize: number; mimeType: string } | null;
  title: string;
}) {
  if (!fileUrl) {
    return (
      <FilePreviewEmpty fileName={file?.fileName} mimeType={file?.mimeType} />
    );
  }

  const fileName = file?.fileName ?? undefined;
  const fileSize = file?.fileSize;

  switch (kind) {
    case "image":
      return (
        <ImagePreviewDialog
          alt={fileName ?? title}
          fileName={fileName}
          src={fileUrl}
        >
          <FileImage alt={fileName ?? title} src={fileUrl} />
        </ImagePreviewDialog>
      );
    case "pdf":
      return (
        <PdfPreviewDialog fileName={fileName} url={fileUrl}>
          <PdfPreview url={fileUrl} />
        </PdfPreviewDialog>
      );
    case "audio":
      return <AudioPreview url={fileUrl} />;
    case "video":
      return <VideoPreview url={fileUrl} />;
    case "markdown":
      return (
        <MarkdownPreview
          fileName={fileName}
          fileSize={fileSize}
          url={fileUrl}
        />
      );
    case "code":
      return (
        <CodePreview fileName={fileName} fileSize={fileSize} url={fileUrl} />
      );
    case "csv":
      return (
        <CsvPreview fileName={fileName} fileSize={fileSize} url={fileUrl} />
      );
    default:
      return (
        <FilePreviewEmpty fileName={file?.fileName} mimeType={file?.mimeType} />
      );
  }
}

export function FileResource({ resource }: { resource: GetResourceData }) {
  const file = "file" in resource ? resource.file : null;
  const fileUrl =
    "fileUrl" in resource ? (resource.fileUrl as string | null) : null;
  const kind = getFilePreviewKind(file?.mimeType, file?.fileName);

  return (
    <PageContent className="mt-2">
      <ResourceHeader resource={resource} />
      <FilePreview
        file={file}
        fileUrl={fileUrl}
        kind={kind}
        title={resource.title}
      />

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
          initialContent={
            "content" in resource
              ? (resource.content?.jsonContent ?? undefined)
              : undefined
          }
          key={resource._id}
          resourceId={resource._id}
          workspaceId={resource.workspaceId}
        />
      </Suspense>
    </PageContent>
  );
}

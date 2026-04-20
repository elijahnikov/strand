import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import { Skeleton } from "@strand/ui/skeleton";
import { Link, useParams } from "@tanstack/react-router";
import { FileIcon, GlobeIcon, PinIcon, StickyNoteIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { CollapsibleSection } from "./collapsible-section";

interface PreviewData {
  domain?: string | null;
  favicon?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  ogImage?: string | null;
  plainTextSnippet?: string | null;
}

interface LinkData {
  _id: Id<"resourceLink">;
  resource: {
    _id: Id<"resource">;
    title: string;
    type: string;
    preview: PreviewData;
  };
  score: number;
  sharedConcepts: string[];
  status: string;
}

function WebsitePreview({ preview }: { preview: PreviewData }) {
  if (preview.ogImage) {
    return (
      <img
        alt=""
        className="h-full w-full object-cover"
        height={50}
        src={preview.ogImage}
        width={50}
      />
    );
  }
  if (preview.favicon) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle">
        <img
          alt=""
          className="h-6 w-6 rounded-sm"
          height={6}
          src={preview.favicon}
          width={6}
        />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle">
      <GlobeIcon className="h-5 w-5 text-ui-fg-muted" />
    </div>
  );
}

function FilePreview({ preview }: { preview: PreviewData }) {
  if (preview.fileUrl && preview.mimeType?.startsWith("image/")) {
    return (
      <img
        alt={preview.fileName ?? ""}
        className="h-full w-full object-cover"
        height={50}
        src={preview.fileUrl}
        width={50}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle">
      <FileKindIcon
        className="h-6 w-6"
        fileName={preview.fileName}
        mimeType={preview.mimeType}
      />
    </div>
  );
}

function NotePreview() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle">
      <StickyNoteIcon className="h-4 w-4 text-ui-fg-muted" />
    </div>
  );
}

function ResourcePreview({
  type,
  preview,
}: {
  type: string;
  preview: PreviewData;
}) {
  switch (type) {
    case "website":
      return <WebsitePreview preview={preview} />;
    case "file":
      return <FilePreview preview={preview} />;
    case "note":
      return <NotePreview />;
    default:
      return (
        <div className="flex h-full w-full items-center justify-center bg-ui-bg-subtle">
          <FileIcon className="h-5 w-5 text-ui-fg-muted" />
        </div>
      );
  }
}

export function RelatedResources({
  links,
  aiStatus,
}: {
  links: LinkData[];
  aiStatus?: string;
}) {
  const { workspaceId } = useParams({
    from: "/_workspace/workspace/$workspaceId/resource/$resourceId",
  });

  const isProcessing = aiStatus === "pending" || aiStatus === "processing";

  const [wasProcessing, setWasProcessing] = useState(isProcessing);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isProcessing) {
      setWasProcessing(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    } else if (wasProcessing && links.length === 0) {
      timerRef.current = setTimeout(() => setWasProcessing(false), 10_000);
      return () => clearTimeout(timerRef.current);
    } else {
      setWasProcessing(false);
    }
  }, [isProcessing, links.length, wasProcessing]);

  const showSkeleton = (isProcessing || wasProcessing) && links.length === 0;

  if (!showSkeleton && links.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      className="mt-12"
      id="related-resources"
      secondary={
        showSkeleton ? undefined : (
          <Badge className="font-mono" size="sm" variant="outline">
            {Math.min(links.length, 6)}
          </Badge>
        )
      }
      title="Related Resources"
    >
      <AnimatePresence mode="wait">
        {showSkeleton ? (
          <motion.div
            className="mt-2 flex flex-col gap-1"
            exit={{ opacity: 0 }}
            key="skeleton"
            transition={{ duration: 0.15 }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                className="flex items-center gap-3 px-3 py-2"
                key={`skeleton-${i.toString()}`}
              >
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex flex-col"
            initial={{ opacity: 0, y: 4 }}
            key="links"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {links.slice(0, 6).map((link) => (
              <Link
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle"
                key={link._id}
                params={{
                  workspaceId,
                  resourceId: link.resource._id,
                }}
                preload="intent"
                to="/workspace/$workspaceId/resource/$resourceId"
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-ui-border-base">
                  <ResourcePreview
                    preview={link.resource.preview}
                    type={link.resource.type}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-sm text-ui-fg-base">
                    {link.resource.title}
                  </span>
                </div>
                {link.status === "pinned" && (
                  <PinIcon className="h-3 w-3 shrink-0 text-ui-fg-subtle" />
                )}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </CollapsibleSection>
  );
}

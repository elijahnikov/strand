import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileIcon, GlobeIcon, StickyNoteIcon } from "lucide-react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { getBrowserTimeZone } from "~/lib/format";
import { CollapsibleSection } from "./collapsible-section";

interface PreviewData {
  domain?: string | null;
  favicon?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  ogImage?: string | null;
  plainTextSnippet?: string | null;
  summary?: string | null;
}

interface SavedItem {
  _id: Id<"resource">;
  preview: PreviewData;
  title: string;
  type: "website" | "note" | "file";
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

export function DailyNoteSavedToday({
  date,
  workspaceId,
}: {
  date: string;
  workspaceId: Id<"workspace">;
}) {
  const { data } = useQuery(
    convexQuery(api.dailyNotes.queries.get, {
      workspaceId,
      date,
      timeZone: getBrowserTimeZone(),
    })
  );

  const items: SavedItem[] = data?.todaysSaves ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      className="mt-12"
      id="daily-note-saved-today"
      secondary={
        <Badge className="font-mono" size="sm" variant="outline">
          {items.length}
        </Badge>
      }
      title="Saved today"
    >
      <div className="mt-2 flex flex-col">
        {items.map((item) => (
          <Link
            className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-subtle"
            key={item._id}
            params={{ workspaceId, resourceId: item._id }}
            preload="intent"
            to="/workspace/$workspaceId/resource/$resourceId"
          >
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-ui-border-base">
              <ResourcePreview preview={item.preview} type={item.type} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm text-ui-fg-base">
                {item.title}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </CollapsibleSection>
  );
}

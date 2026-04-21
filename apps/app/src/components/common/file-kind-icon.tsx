import {
  RiCodeSSlashFill,
  RiFileExcelFill,
  RiFileFill,
  RiFileMusicFill,
  RiFilePdf2Fill,
  RiFileVideoFill,
  RiImageFill,
  RiMarkdownFill,
} from "@remixicon/react";
import { cn } from "@omi/ui";
import { type FilePreviewKind, getFilePreviewKind } from "~/lib/format";

export const FILE_KIND_ICONS: Record<FilePreviewKind, typeof RiFileFill> = {
  image: RiImageFill,
  pdf: RiFilePdf2Fill,
  audio: RiFileMusicFill,
  video: RiFileVideoFill,
  markdown: RiMarkdownFill,
  code: RiCodeSSlashFill,
  csv: RiFileExcelFill,
  unsupported: RiFileFill,
};

export function FileKindIcon({
  className,
  fileName,
  mimeType,
}: {
  className?: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const kind = getFilePreviewKind(mimeType ?? undefined, fileName ?? undefined);
  const Icon = FILE_KIND_ICONS[kind];
  return <Icon className={cn("h-4 w-4 text-ui-fg-muted", className)} />;
}

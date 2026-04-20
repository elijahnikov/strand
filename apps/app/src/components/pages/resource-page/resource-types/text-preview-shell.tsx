import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { FileIcon } from "lucide-react";
import { formatFileSize } from "~/lib/format";

export function TextPreviewLoading() {
  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="relative h-[300px] w-full">
        <FlickeringGrid
          className="size-full"
          color="#6B7280"
          flickerChance={0.1}
          gridGap={6}
          maxOpacity={0.5}
          squareSize={4}
        />
      </div>
    </Card>
  );
}

export function TextPreviewError({
  message,
  fileName,
  fileSize,
}: {
  message: string;
  fileName?: string;
  fileSize?: number;
}) {
  return (
    <div className="mt-4 flex h-[200px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted">
      <FileIcon className="h-8 w-8" />
      <span className="font-mono text-xs">{message}</span>
      {fileName && (
        <span className="font-mono text-ui-fg-subtle text-xs">
          {fileName}
          {fileSize ? ` — ${formatFileSize(fileSize)}` : ""}
        </span>
      )}
    </div>
  );
}

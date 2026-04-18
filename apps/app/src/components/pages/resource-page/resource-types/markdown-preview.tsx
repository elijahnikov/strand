import { Streamdown } from "streamdown";
import { TextPreviewError, TextPreviewLoading } from "./text-preview-shell";
import { useFileText } from "./use-file-text";

export function MarkdownPreview({
  url,
  fileName,
  fileSize,
}: {
  url: string;
  fileName?: string;
  fileSize?: number;
}) {
  const state = useFileText(url);

  if (state.status === "loading") {
    return <TextPreviewLoading />;
  }

  if (state.status === "error") {
    return (
      <TextPreviewError
        fileName={fileName}
        fileSize={fileSize}
        message={`Failed to load markdown — ${state.message}`}
      />
    );
  }

  if (state.status === "too-large") {
    return (
      <TextPreviewError
        fileName={fileName}
        fileSize={fileSize}
        message="File is too large to preview"
      />
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base">
      <div className="prose prose-sm dark:prose-invert max-h-[600px] max-w-none overflow-auto px-5 py-4">
        <Streamdown>{state.text}</Streamdown>
      </div>
    </div>
  );
}

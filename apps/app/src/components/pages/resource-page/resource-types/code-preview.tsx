import { File as PierreFile } from "@pierre/diffs/react";
import { FileCodeIcon } from "lucide-react";
import { getCodeLanguage } from "~/lib/format";
import { TextPreviewError, TextPreviewLoading } from "./text-preview-shell";
import { useFileText } from "./use-file-text";

const CODE_FILE_OPTIONS = {
  disableFileHeader: true,
  theme: {
    light: "github-light-high-contrast" as const,
    dark: "github-dark-high-contrast" as const,
  },
  unsafeCSS: `
    :host {
      --diffs-font-family: "IoskeleyMono", var(--diffs-font-fallback);
    }
  `,
};

export function CodePreview({
  url,
  fileName,
  fileSize,
}: {
  url: string;
  fileName?: string;
  fileSize?: number;
}) {
  const state = useFileText(url);
  const language = getCodeLanguage(fileName);

  if (state.status === "loading") {
    return <TextPreviewLoading />;
  }

  if (state.status === "error") {
    return (
      <TextPreviewError
        fileName={fileName}
        fileSize={fileSize}
        message={`Failed to load file — ${state.message}`}
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

  const displayName = fileName ?? "file";

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-ui-border-base">
      <div className="flex items-center gap-2 border-ui-border-base border-b bg-ui-bg-subtle px-3 py-2">
        <FileCodeIcon className="h-3.5 w-3.5 text-ui-fg-muted" />
        <span className="font-mono text-ui-fg-subtle text-xs">
          {displayName}
        </span>
        {language && (
          <span className="ml-auto font-mono text-ui-fg-muted text-xs">
            {language}
          </span>
        )}
      </div>
      <div className="max-h-[600px] overflow-auto">
        <PierreFile
          file={{ name: displayName, contents: state.text }}
          options={CODE_FILE_OPTIONS}
        />
      </div>
    </div>
  );
}

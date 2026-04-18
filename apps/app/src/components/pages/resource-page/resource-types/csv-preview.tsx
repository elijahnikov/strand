import { useMemo } from "react";
import { TextPreviewError, TextPreviewLoading } from "./text-preview-shell";
import { useFileText } from "./use-file-text";

const MAX_ROWS = 100;

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === delimiter) {
      current.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (char === "\r") {
      i += 1;
      continue;
    }

    if (char === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

export function CsvPreview({
  url,
  fileName,
  fileSize,
}: {
  url: string;
  fileName?: string;
  fileSize?: number;
}) {
  const state = useFileText(url);
  const delimiter = fileName?.toLowerCase().endsWith(".tsv") ? "\t" : ",";

  const parsed = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }
    return parseCsv(state.text, delimiter);
  }, [state, delimiter]);

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

  if (!parsed || parsed.length === 0) {
    return (
      <TextPreviewError
        fileName={fileName}
        fileSize={fileSize}
        message="Empty file"
      />
    );
  }

  const [header, ...rows] = parsed;
  const visibleRows = rows.slice(0, MAX_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-ui-border-base">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-ui-bg-subtle">
            <tr>
              {header?.map((cell, i) => (
                <th
                  className="border-ui-border-base border-b px-3 py-2 text-left font-medium text-ui-fg-base"
                  key={`h-${i.toString()}`}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr
                className="even:bg-ui-bg-subtle/50"
                key={`r-${ri.toString()}`}
              >
                {row.map((cell, ci) => (
                  <td
                    className="border-ui-border-base border-b px-3 py-1.5 text-ui-fg-subtle"
                    key={`c-${ri.toString()}-${ci.toString()}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className="border-ui-border-base border-t bg-ui-bg-subtle px-3 py-2 text-center font-mono text-ui-fg-muted text-xs">
          {hiddenCount} more row{hiddenCount === 1 ? "" : "s"} not shown
        </div>
      )}
    </div>
  );
}

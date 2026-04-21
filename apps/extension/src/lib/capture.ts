import { api } from "@/lib/api";

export interface CaptureResult {
  resourceId: string;
}

const SELECTION_TITLE_MAX_LEN = 60;
const LINE_SPLIT_RE = /\r?\n+/;
const FILE_EXT_RE = /\.[a-z0-9]{2,5}$/i;

export async function captureWebsite(input: {
  url: string;
  title: string;
  description?: string | null;
}): Promise<CaptureResult> {
  return await api.captureWebsite({
    url: input.url,
    title: input.title,
    description: input.description ?? undefined,
  });
}

export async function captureSelection(input: {
  selection: string;
  sourceUrl: string;
  sourceTitle: string;
}): Promise<CaptureResult> {
  const trimmed = input.selection.trim();
  if (!trimmed) {
    throw new Error("Selection is empty");
  }
  const title =
    trimmed.length > SELECTION_TITLE_MAX_LEN
      ? `${trimmed.slice(0, SELECTION_TITLE_MAX_LEN)}…`
      : trimmed;

  const jsonContent = JSON.stringify(buildSelectionDoc(trimmed, input));

  return await api.captureNote({
    title,
    plainTextContent: trimmed,
    jsonContent,
  });
}

function buildSelectionDoc(
  selection: string,
  source: { sourceUrl: string; sourceTitle: string }
) {
  return {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: selection
          .split(LINE_SPLIT_RE)
          .filter((line) => line.length > 0)
          .map((line) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          })),
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "— Source: " },
          {
            type: "text",
            text: source.sourceTitle || source.sourceUrl,
            marks: [
              {
                type: "link",
                attrs: { href: source.sourceUrl },
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function captureScreenshot(input: {
  tabId: number;
  domain: string;
}): Promise<CaptureResult> {
  const dataUrl = await chrome.tabs.captureVisibleTab({
    format: "png",
  });
  if (!dataUrl) {
    throw new Error("Could not capture tab");
  }
  const blob = await dataUrlToBlob(dataUrl);
  const fileName = `${input.domain}-${Date.now()}.png`;
  return await uploadAsFileResource(blob, fileName, "image/png");
}

export async function captureImage(input: {
  srcUrl: string;
  sourceUrl: string;
}): Promise<CaptureResult> {
  const response = await fetch(input.srcUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch image (${response.status})`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || "application/octet-stream";
  const fileName = deriveImageFileName(input.srcUrl, mimeType);
  return await uploadAsFileResource(blob, fileName, mimeType);
}

export async function captureScratchpad(input: {
  title: string;
  jsonContent: string;
  plainTextContent: string;
}): Promise<CaptureResult> {
  return await api.captureNote({
    title: input.title,
    plainTextContent: input.plainTextContent,
    jsonContent: input.jsonContent,
  });
}

async function uploadAsFileResource(
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<CaptureResult> {
  const { uploadUrl } = await api.uploadUrl();
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": mimeType },
    body: blob,
  });
  if (!upload.ok) {
    throw new Error(`Upload failed (${upload.status})`);
  }
  const { storageId } = (await upload.json()) as { storageId: string };
  const dimensions = await maybeReadImageDimensions(blob, mimeType);
  return await api.captureFile({
    storageId,
    fileName,
    mimeType,
    fileSize: blob.size,
    width: dimensions?.width,
    height: dimensions?.height,
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function deriveImageFileName(srcUrl: string, mimeType: string): string {
  try {
    const url = new URL(srcUrl);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last && FILE_EXT_RE.test(last)) {
      return last;
    }
  } catch {
    // fall through
  }
  const ext = mimeType.split("/")[1] ?? "bin";
  return `image-${Date.now()}.${ext}`;
}

async function maybeReadImageDimensions(
  blob: Blob,
  mimeType: string
): Promise<{ width: number; height: number } | null> {
  if (!mimeType.startsWith("image/")) {
    return null;
  }
  if (typeof createImageBitmap === "undefined") {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dims;
  } catch {
    return null;
  }
}

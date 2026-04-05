export async function downloadFile(url: string, fileName?: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName ?? "download";
  a.click();
  URL.revokeObjectURL(blobUrl);
}

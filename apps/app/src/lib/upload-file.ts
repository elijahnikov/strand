import type { Id } from "@strand/backend/_generated/dataModel.js";

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface CreateFileResourceArgs {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageId: Id<"_storage">;
  title: string;
  type: "file";
  workspaceId: Id<"workspace">;
}

interface UploadFileArgs {
  createResource: (args: CreateFileResourceArgs) => void;
  file: File;
  generateUploadUrl: () => Promise<string>;
  workspaceId: Id<"workspace">;
}

export async function uploadFile({
  file,
  workspaceId,
  generateUploadUrl,
  createResource,
}: UploadFileArgs): Promise<void> {
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };

  createResource({
    workspaceId,
    type: "file",
    title: file.name,
    storageId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
}

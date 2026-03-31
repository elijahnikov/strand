import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useCallback, useState } from "react";
import { usePasteHandler } from "~/hooks/use-paste-handler";
import { ResourceList } from "./resource-list";

export function LibraryPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const createResource = useConvexMutation(api.resource.mutations.create);
  const generateUploadUrl = useConvexMutation(
    api.resource.mutations.generateUploadUrl
  );

  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const handleUrl = useCallback(
    (url: string) => {
      createResource({
        workspaceId,
        type: "website",
        title: url,
        url,
      });
    },
    [createResource, workspaceId]
  );

  const handleText = useCallback(
    (text: string) => {
      createResource({
        workspaceId,
        type: "note",
        title: text.slice(0, 100),
        plainTextContent: text,
      });
    },
    [createResource, workspaceId]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const fileId = `${file.name}-${Date.now()}`;
        setUploadingFiles((prev) => [...prev, fileId]);

        try {
          const uploadUrl = await generateUploadUrl({});
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = (await response.json()) as {
            storageId: Id<"_storage">;
          };

          await createResource({
            workspaceId,
            type: "file",
            title: file.name,
            storageId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
        } finally {
          setUploadingFiles((prev) => prev.filter((id) => id !== fileId));
        }
      }
    },
    [createResource, generateUploadUrl, workspaceId]
  );

  usePasteHandler({
    onUrl: handleUrl,
    onText: handleText,
    onFiles: handleFiles,
  });

  return (
    <div className="mx-auto w-2/3 px-6 pt-4 pb-4">
      <ResourceList workspaceId={workspaceId} />
      {uploadingFiles.length > 0 && (
        <div className="fixed right-4 bottom-4 rounded-lg bg-ui-bg-field p-3 text-sm text-ui-fg-subtle shadow-lg">
          Uploading {uploadingFiles.length} file
          {uploadingFiles.length > 1 ? "s" : ""}...
        </div>
      )}
    </div>
  );
}

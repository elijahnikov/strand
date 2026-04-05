import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useFileDropHandler } from "~/hooks/use-file-drop";
import { usePasteHandler } from "~/hooks/use-paste-handler";
import { LibraryToolbar } from "./library-toolbar";
import { ResourceList } from "./resource-list";

export function LibraryPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { mutate: createResource } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.create),
  });

  const { mutate: createCollection } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.create),
  });

  const [pendingCollection, setPendingCollection] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { mutateAsync: generateUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.generateUploadUrl),
  });

  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; name: string; batchId: string }[]
  >([]);

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
      const batchId = `batch-${Date.now()}`;
      const entries = files.map((file, i) => ({
        id: `${file.name}-${Date.now()}-${i}`,
        name: file.name,
        batchId,
      }));
      setUploadingFiles((prev) => [...entries, ...prev]);

      // Upload all files in parallel
      await Promise.all(
        files.map(async (file, i) => {
          try {
            const uploadUrl = await generateUploadUrl({});
            const response = await fetch(uploadUrl as string, {
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
          } catch {
            const entry = entries[i];
            if (entry) {
              setUploadingFiles((prev) =>
                prev.filter((f) => f.id !== entry.id)
              );
            }
          }
        })
      );
    },
    [createResource, generateUploadUrl, workspaceId]
  );

  const handleClearBatch = useCallback((batchId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.batchId !== batchId));
  }, []);

  const handleCreateCollection = useCallback(() => {
    const name = "New collection";
    const id = `pending-${Date.now()}`;
    setPendingCollection({ id, name });
    createCollection({ workspaceId, name });
  }, [createCollection, workspaceId]);

  usePasteHandler({
    onUrl: handleUrl,
    onText: handleText,
    onFiles: handleFiles,
  });

  useFileDropHandler(handleFiles);

  return (
    <div>
      <LibraryToolbar onCreateCollection={handleCreateCollection} />
      <div className="mx-auto w-2/3 px-6 pt-4 pb-4">
        <ResourceList
          onClearBatch={handleClearBatch}
          onClearPendingCollection={() => setPendingCollection(null)}
          pendingCollection={pendingCollection}
          uploadingFiles={uploadingFiles}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}

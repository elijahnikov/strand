import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useFileDropHandler } from "~/hooks/use-file-drop";
import { usePasteHandler } from "~/hooks/use-paste-handler";
import { LibraryToolbar } from "../../pages/library-page/library-toolbar";
import { ResourceList } from "../../pages/library-page/resource-list";
import { CollectionHeader } from "./collection-header";

export function CollectionPageComponent({
  collectionId,
  workspaceId,
}: {
  collectionId: Id<"collection">;
  workspaceId: Id<"workspace">;
}) {
  const { data: collection } = useSuspenseQuery(
    convexQuery(api.collection.queries.get, { workspaceId, collectionId })
  );

  const { mutate: createResource } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.create),
  });

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
        collectionId,
      });
    },
    [createResource, workspaceId, collectionId]
  );

  const handleText = useCallback(
    (text: string) => {
      createResource({
        workspaceId,
        type: "note",
        title: text.slice(0, 100),
        plainTextContent: text,
        collectionId,
      });
    },
    [createResource, workspaceId, collectionId]
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
              collectionId,
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
    [createResource, generateUploadUrl, workspaceId, collectionId]
  );

  const handleClearBatch = useCallback((batchId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.batchId !== batchId));
  }, []);

  usePasteHandler({
    onUrl: handleUrl,
    onText: handleText,
    onFiles: handleFiles,
  });

  useFileDropHandler(handleFiles);

  if (!collection) {
    return null;
  }

  return (
    <div>
      <LibraryToolbar />
      <div className="mx-auto w-2/3 px-6 pt-4 pb-4">
        <CollectionHeader collection={collection} workspaceId={workspaceId} />
        <ResourceList
          collectionId={collectionId}
          onClearBatch={handleClearBatch}
          uploadingFiles={uploadingFiles}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}

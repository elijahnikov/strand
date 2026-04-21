import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { toastManager } from "@omi/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { PageContent } from "~/components/common/page-content";
import { useFileDropHandler } from "~/hooks/use-file-drop";
import { usePasteHandler } from "~/hooks/use-paste-handler";
import { MAX_FILE_SIZE, uploadFile } from "~/lib/upload-file";
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
      const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE);
      if (validFiles.length < files.length) {
        toastManager.add({
          type: "error",
          title: "Files over 50MB are not supported",
        });
        if (validFiles.length === 0) {
          return;
        }
      }

      const batchId = `batch-${Date.now()}`;
      const entries = validFiles.map((file, i) => ({
        id: `${file.name}-${Date.now()}-${i}`,
        name: file.name,
        batchId,
      }));
      setUploadingFiles((prev) => [...entries, ...prev]);

      await Promise.all(
        validFiles.map(async (file, i) => {
          try {
            await uploadFile({
              file,
              workspaceId,
              generateUploadUrl: () => generateUploadUrl({}) as Promise<string>,
              createResource,
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
      <PageContent className="pt-14 pb-4 md:pt-4" width="xl:w-2/3">
        <ResourceList
          onClearBatch={handleClearBatch}
          onClearPendingCollection={() => setPendingCollection(null)}
          pendingCollection={pendingCollection}
          uploadingFiles={uploadingFiles}
          workspaceId={workspaceId}
        />
      </PageContent>
    </div>
  );
}

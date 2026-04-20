import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Button } from "@strand/ui/button";
import { Checkbox } from "@strand/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Input } from "@strand/ui/input";
import { Label } from "@strand/ui/label";
import { LoadingButton } from "@strand/ui/loading-button";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { UiImportSource } from "./sources";

export function SourceDialog({
  source,
  workspaceId,
  open,
  onOpenChange,
}: {
  source: UiImportSource | null;
  workspaceId: Id<"workspace">;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  if (!source) {
    return null;
  }
  if (source.kind === "file") {
    return (
      <FileSourceDialog
        onOpenChange={onOpenChange}
        open={open}
        source={source}
        workspaceId={workspaceId}
      />
    );
  }
  return (
    <ConnectionSourceDialog
      onOpenChange={onOpenChange}
      open={open}
      source={source}
      workspaceId={workspaceId}
    />
  );
}

function FileSourceDialog({
  source,
  workspaceId,
  open,
  onOpenChange,
}: {
  source: Extract<UiImportSource, { kind: "file" }>;
  workspaceId: Id<"workspace">;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [createRoot, setCreateRoot] = useState(true);
  const [rootName, setRootName] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [rehydrate, setRehydrate] = useState(true);
  const [uploading, setUploading] = useState(false);

  const { mutateAsync: getUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.imports.actions.generateImportUploadUrl),
  });
  const { mutateAsync: startImport } = useMutation({
    mutationFn: useConvexMutation(api.imports.mutations.startImport),
  });

  const reset = () => {
    setFile(null);
    setCreateRoot(true);
    setRootName("");
    setDedupe(true);
    setRehydrate(true);
  };

  const handleStart = async () => {
    if (!file) {
      return;
    }
    try {
      setUploading(true);
      const uploadUrl = await getUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };

      await startImport({
        workspaceId,
        source: source.source,
        uiSourceId: source.id,
        storageId,
        options: {
          createRootCollection: createRoot,
          rootCollectionName: rootName.trim() || undefined,
          rehydrateUrls: rehydrate,
          dedupe,
        },
      });

      toastManager.add({
        type: "success",
        title: "Import queued",
        description: `${source.label} import started.`,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Import failed to start",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            Import from {source.label}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <DialogDescription>{source.instructions}</DialogDescription>
          <div className="flex flex-col gap-1.5">
            <Label>File</Label>
            <Input
              accept={source.accept}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              type="file"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2" htmlFor="import-root">
              <Checkbox
                checked={createRoot}
                id="import-root"
                onCheckedChange={(c) => setCreateRoot(Boolean(c))}
              />
              <Text size="small">Create a root collection for this import</Text>
            </label>
            {createRoot && (
              <Input
                className="ml-6 max-w-xs"
                onChange={(e) => setRootName(e.target.value)}
                placeholder={`Imported from ${source.label}`}
                value={rootName}
              />
            )}
            <label
              className="mt-2 flex items-center gap-2"
              htmlFor="import-dedupe"
            >
              <Checkbox
                checked={dedupe}
                id="import-dedupe"
                onCheckedChange={(c) => setDedupe(Boolean(c))}
              />
              <Text size="small">Skip items already imported</Text>
            </label>
            {source.source !== "markdown_zip" &&
              source.source !== "notion_zip" &&
              source.source !== "evernote_enex" && (
                <label
                  className="flex items-center gap-2"
                  htmlFor="import-rehydrate"
                >
                  <Checkbox
                    checked={rehydrate}
                    id="import-rehydrate"
                    onCheckedChange={(c) => setRehydrate(Boolean(c))}
                  />
                  <Text size="small">Fetch titles and metadata for URLs</Text>
                </label>
              )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Cancel
          </DialogClose>
          <LoadingButton
            disabled={!file}
            loading={uploading}
            onClick={handleStart}
            variant="strand"
          >
            Start import
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function ConnectionSourceDialog({
  source,
  workspaceId,
  open,
  onOpenChange,
}: {
  source: Extract<UiImportSource, { kind: "connection" }>;
  workspaceId: Id<"workspace">;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [createRoot, setCreateRoot] = useState(true);
  const [rootName, setRootName] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [starting, setStarting] = useState(false);

  const { data: connections } = useQuery(
    convexQuery(api.connections.queries.listMyConnections, {})
  );
  const activeConnection = connections?.find(
    (c) => c.provider === source.provider && c.status === "active"
  );

  const { mutateAsync: startImport } = useMutation({
    mutationFn: useConvexMutation(api.imports.mutations.startImport),
  });

  const handleStart = async () => {
    if (!activeConnection) {
      return;
    }
    try {
      setStarting(true);
      await startImport({
        workspaceId,
        source: source.source,
        uiSourceId: source.id,
        connectionId: activeConnection._id,
        options: {
          createRootCollection: createRoot,
          rootCollectionName: rootName.trim() || undefined,
          rehydrateUrls: false,
          dedupe,
        },
      });
      toastManager.add({
        type: "success",
        title: "Import queued",
        description: `${source.label} import started.`,
      });
      onOpenChange(false);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Import failed to start",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            Import from {source.label}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          {activeConnection ? (
            <>
              <DialogDescription>
                Importing from{" "}
                <strong>
                  {activeConnection.providerAccountLabel ?? source.label}
                </strong>
                . This pulls all available items and may take a few minutes.
              </DialogDescription>
              <div className="flex flex-col gap-2">
                <label
                  className="flex items-center gap-2"
                  htmlFor="import-root"
                >
                  <Checkbox
                    checked={createRoot}
                    id="import-root"
                    onCheckedChange={(c) => setCreateRoot(Boolean(c))}
                  />
                  <Text size="small">
                    Create a root collection for this import
                  </Text>
                </label>
                {createRoot && (
                  <Input
                    className="ml-6 max-w-xs"
                    onChange={(e) => setRootName(e.target.value)}
                    placeholder={`Imported from ${source.label}`}
                    value={rootName}
                  />
                )}
                <label
                  className="mt-2 flex items-center gap-2"
                  htmlFor="import-dedupe"
                >
                  <Checkbox
                    checked={dedupe}
                    id="import-dedupe"
                    onCheckedChange={(c) => setDedupe(Boolean(c))}
                  />
                  <Text size="small">Skip items already imported</Text>
                </label>
              </div>
            </>
          ) : (
            <DialogDescription>
              You need to connect {source.label} first. Open the Connections tab
              in account settings to link your account.
            </DialogDescription>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Cancel
          </DialogClose>
          {activeConnection ? (
            <LoadingButton
              loading={starting}
              onClick={handleStart}
              variant="strand"
            >
              Start import
            </LoadingButton>
          ) : (
            <Button
              onClick={() => {
                onOpenChange(false);
                router.navigate({ to: "/account" });
              }}
              variant="strand"
            >
              Open connections
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

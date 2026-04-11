import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Button } from "@strand/ui/button";
import { Input } from "@strand/ui/input";
import { toastManager } from "@strand/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, FolderPlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { ResourceBadge } from "./resource-badge";

export interface CollectionProposal {
  createdCollectionId?: Id<"collection">;
  createdMovedCount?: number;
  name: string;
  reason: string;
  resourceIds: string[];
  resources: Array<{ id: string; title: string; type: string }>;
}

interface ProposeCollectionCardProps {
  proposal: CollectionProposal;
  threadId?: Id<"chatThread">;
  toolCallId: string;
  workspaceId: Id<"workspace">;
}

type CardState =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "created"; collectionId: Id<"collection">; movedCount: number }
  | { kind: "discarded" }
  | { kind: "error"; message: string };

export function ProposeCollectionCard({
  workspaceId,
  proposal,
  threadId,
  toolCallId,
}: ProposeCollectionCardProps) {
  const [name, setName] = useState(proposal.name);
  const [state, setState] = useState<CardState>(() =>
    proposal.createdCollectionId
      ? {
          kind: "created",
          collectionId: proposal.createdCollectionId,
          movedCount: proposal.createdMovedCount ?? 0,
        }
      : { kind: "idle" }
  );

  const { mutateAsync: createWithResources } = useMutation({
    mutationFn: useConvexMutation(api.collection.mutations.createWithResources),
  });

  const { mutateAsync: updateToolPartOutput } = useMutation({
    mutationFn: useConvexMutation(api.chat.mutations.updateToolPartOutput),
  });

  if (state.kind === "discarded") {
    return null;
  }

  const hasResources = proposal.resources.length > 0;
  const isBusy = state.kind === "creating";
  const isDone = state.kind === "created";

  const persistCreated = async (
    collectionId: Id<"collection">,
    movedCount: number
  ) => {
    if (!threadId) {
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await updateToolPartOutput({
          workspaceId,
          threadId,
          toolCallId,
          outputPatch: {
            name,
            createdCollectionId: collectionId,
            createdMovedCount: movedCount,
          },
        });
        if (result.found) {
          return;
        }
      } catch (err) {
        console.error("[updateToolPartOutput] failed:", err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  };

  const handleCreate = async () => {
    setState({ kind: "creating" });
    try {
      const result = await createWithResources({
        workspaceId,
        name,
        resourceIds: proposal.resourceIds as Id<"resource">[],
      });
      toastManager.add({
        type: "success",
        title: `Created "${name.trim() || "Untitled collection"}"`,
        description: `${result.movedCount} resource${result.movedCount === 1 ? "" : "s"} added`,
      });
      setState({
        kind: "created",
        collectionId: result.collectionId,
        movedCount: result.movedCount,
      });
      void persistCreated(result.collectionId, result.movedCount);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to create collection";
      setState({ kind: "error", message });
      toastManager.add({ type: "error", title: message });
    }
  };

  return (
    <div className="w-full max-w-full rounded-xl bg-ui-bg-component p-3">
      <div>
        <Input
          className="h-8 text-sm"
          disabled={isBusy || isDone}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
          value={name}
        />
      </div>

      {hasResources ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {proposal.resources.map((r) => (
            <ResourceBadge
              key={r.id}
              resourceId={r.id}
              title={r.title}
              type={r.type}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-ui-fg-muted">
          No resources matched.
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1.5">
        {state.kind === "idle" && (
          <>
            <Button
              onClick={() => setState({ kind: "discarded" })}
              size="small"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
              Discard
            </Button>
            <Button
              disabled={!hasResources || name.trim().length === 0}
              onClick={handleCreate}
              size="small"
              variant="secondary"
            >
              <FolderPlusIcon className="size-3.5" />
              Create collection
            </Button>
          </>
        )}
        {state.kind === "creating" && (
          <div className="flex items-center gap-2 text-[12px] text-ui-fg-muted">
            <Loader2Icon className="size-3.5 animate-spin" />
            Creating...
          </div>
        )}
        {state.kind === "created" && (
          <Link
            className="inline-flex items-center gap-1.5 rounded-md bg-ui-bg-component px-2 py-1 font-medium text-[12px] text-ui-fg-base hover:bg-ui-bg-component-hover"
            params={{
              workspaceId: workspaceId as string,
              collectionId: state.collectionId as string,
            }}
            to="/workspace/$workspaceId/library/collection/$collectionId"
          >
            <CheckIcon className="size-3.5" />
            Created · view collection
          </Link>
        )}
        {state.kind === "error" && (
          <>
            <span className="text-[12px] text-ui-fg-error">
              {state.message}
            </span>
            <Button onClick={handleCreate} size="small" variant="ghost">
              Retry
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

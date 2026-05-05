import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@omi/ui/dialog";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WorkspaceIcon } from "~/components/common/workspace-icon";
import { GithubScopeEditor, GithubSyncForm } from "./providers/github-config";
import {
  type ConfigConnection,
  DestinationPicker,
  type ProviderId,
  toErrorMessage,
  type WorkspaceOption,
  WorkspacePicker,
} from "./shared";

export type { ConfigConnection, ProviderId } from "./shared";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  notion: "Notion",
  raindrop: "Raindrop.io",
  readwise: "Readwise",
  github: "GitHub",
};

export function ProviderConfigDialog({
  connection,
  onOpenChange,
  onReconnect,
  open,
}: {
  connection: ConfigConnection | null;
  onOpenChange: (next: boolean) => void;
  onReconnect: (provider: ProviderId) => void;
  open: boolean;
}) {
  if (!connection) {
    return null;
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-xl!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            {PROVIDER_LABEL[connection.provider]} settings
          </DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-8 overflow-y-auto px-6 py-4">
          <AccountSummary connection={connection} />
          {connection.supportsSync ? (
            <SyncPanel
              connection={connection}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <Text className="text-ui-fg-subtle" size="small">
              Continuous sync isn't available for this provider yet.
            </Text>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onReconnect(connection.provider);
              onOpenChange(false);
            }}
            variant="secondary"
          >
            Reconnect
          </Button>
          <DisconnectButton
            connectionId={connection._id}
            onDone={() => onOpenChange(false)}
          />
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function AccountSummary({ connection }: { connection: ConfigConnection }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Text className="font-medium" size="small">
          Account
        </Text>
        <Badge
          size="sm"
          variant={
            connection.status === "active"
              ? "mono"
              : connection.status === "error"
                ? "destructive"
                : "warning"
          }
        >
          {connection.status === "active"
            ? "Connected"
            : connection.status === "expired"
              ? "Reconnect"
              : connection.status === "paused"
                ? "Paused"
                : "Error"}
        </Badge>
      </div>
      <Text className="text-ui-fg-subtle" size="small">
        {connection.providerAccountLabel ?? "Connected account"}
      </Text>
      {connection.status === "error" && connection.lastError ? (
        <Text className="text-ui-fg-error" size="small">
          {connection.lastError}
        </Text>
      ) : null}
    </div>
  );
}

function DisconnectButton({
  connectionId,
  onDone,
}: {
  connectionId: Id<"connection">;
  onDone: () => void;
}) {
  const { mutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.connections.mutations.disconnect),
    onSuccess: () => {
      toastManager.add({ type: "success", title: "Disconnected" });
      onDone();
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not disconnect",
        description: toErrorMessage(err),
      });
    },
  });
  return (
    <LoadingButton
      loading={isPending}
      onClick={() => mutate({ connectionId })}
      variant="secondary"
    >
      Disconnect
    </LoadingButton>
  );
}

function SyncPanel({
  connection,
  onClose,
}: {
  connection: ConfigConnection;
  onClose: () => void;
}) {
  const { data: billing, isPending: billingPending } = useQuery(
    convexQuery(api.billing.queries.getMyBillingState, {})
  );
  const { data: workspaces } = useQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );

  if (billingPending) {
    return <div className="h-24" />;
  }

  const isPro = billing?.plan === "pro";

  if (!isPro) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="warning">Pro</Badge>
          <Text size="small">
            Continuous sync keeps {connection.providerAccountLabel ?? "this"}{" "}
            content up to date automatically.
          </Text>
        </div>
        <Button
          onClick={() => {
            window.location.href = "/settings/usage-and-billing";
          }}
          size="small"
          variant="omi"
        >
          Upgrade
        </Button>
      </div>
    );
  }

  if (connection.syncEnabled || connection.status === "paused") {
    return (
      <ConfiguredSyncBody
        connection={connection}
        onClose={onClose}
        workspaces={workspaces ?? []}
      />
    );
  }

  return (
    <UnconfiguredSyncBody
      connection={connection}
      onClose={onClose}
      workspaces={workspaces ?? []}
    />
  );
}

function UnconfiguredSyncBody({
  connection,
  onClose,
  workspaces,
}: {
  connection: ConfigConnection;
  onClose: () => void;
  workspaces: WorkspaceOption[];
}) {
  const [workspaceId, setWorkspaceId] = useState<Id<"workspace"> | undefined>(
    connection.workspaceId ?? workspaces[0]?._id
  );
  const [destinationCollectionId, setDestinationCollectionId] = useState<
    Id<"collection"> | undefined
  >(connection.destinationCollectionId);

  useEffect(() => {
    if (!workspaceId && workspaces[0]) {
      setWorkspaceId(workspaces[0]._id);
    }
  }, [workspaceId, workspaces]);

  const handleWorkspaceChange = (next: Id<"workspace">) => {
    setWorkspaceId(next);
    // Collections belong to a workspace; reset when the workspace changes.
    setDestinationCollectionId(undefined);
  };

  const enable = useMutation({
    mutationFn: useConvexMutation(api.connections.mutations.enableSync),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "Sync enabled",
        description: "Initial backfill is running in the background.",
      });
      onClose();
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Could not enable sync",
        description: toErrorMessage(err),
      }),
  });

  if (connection.provider === "github") {
    return (
      <GithubSyncForm
        connection={connection}
        destinationCollectionId={destinationCollectionId}
        onDestinationChange={setDestinationCollectionId}
        onWorkspaceChange={handleWorkspaceChange}
        workspaceId={workspaceId}
        workspaces={workspaces}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Text className="font-medium" size="small">
        Continuous sync
      </Text>
      <WorkspacePicker
        onChange={handleWorkspaceChange}
        value={workspaceId}
        workspaces={workspaces}
      />
      <DestinationPicker
        onChange={setDestinationCollectionId}
        value={destinationCollectionId}
        workspaceId={workspaceId}
      />
      <div>
        <LoadingButton
          disabled={!workspaceId}
          loading={enable.isPending}
          onClick={() => {
            if (!workspaceId) {
              return;
            }
            enable.mutate({
              connectionId: connection._id,
              workspaceId,
              destinationCollectionId,
            });
          }}
          size="small"
          variant="omi"
        >
          Enable sync
        </LoadingButton>
      </div>
    </div>
  );
}

function ConfiguredSyncBody({
  connection,
  onClose,
  workspaces,
}: {
  connection: ConfigConnection;
  onClose: () => void;
  workspaces: WorkspaceOption[];
}) {
  const isPaused = connection.status === "paused";
  const isActive = Boolean(connection.syncEnabled) && !isPaused;
  const currentWorkspace = workspaces.find(
    (w) => w._id === connection.workspaceId
  );

  const triggerNow = useMutation({
    mutationFn: useConvexMutation(api.connections.mutations.triggerSyncNow),
    onSuccess: () =>
      toastManager.add({ type: "success", title: "Sync queued" }),
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Could not trigger sync",
        description: toErrorMessage(err),
      }),
  });

  const setPaused = useMutation({
    mutationFn: useConvexMutation(api.connections.mutations.setSyncPaused),
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Could not update sync",
        description: toErrorMessage(err),
      }),
  });

  const setDestination = useMutation({
    mutationFn: useConvexMutation(
      api.connections.mutations.setDestinationCollection
    ),
    onSuccess: () =>
      toastManager.add({ type: "success", title: "Destination updated" }),
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Could not update destination",
        description: toErrorMessage(err),
      }),
  });

  return (
    <div className="-mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge size="sm" variant={isActive ? "mono" : "warning"}>
            {isActive ? "Sync on" : "Paused"}
          </Badge>
          <Text className="text-ui-fg-subtle" size="small">
            {connection.lastSyncedAt
              ? `Last synced ${formatRelativeTime(connection.lastSyncedAt)}`
              : "Not yet synced"}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <LoadingButton
            disabled={!isActive}
            loading={triggerNow.isPending}
            onClick={() => triggerNow.mutate({ connectionId: connection._id })}
            size="small"
            variant="secondary"
          >
            Sync now
          </LoadingButton>
          <LoadingButton
            loading={setPaused.isPending}
            onClick={() =>
              setPaused.mutate({
                connectionId: connection._id,
                paused: isActive,
              })
            }
            size="small"
            variant="secondary"
          >
            {isActive ? "Pause" : "Resume"}
          </LoadingButton>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Text className="font-medium" size="small">
          Workspace
        </Text>
        {currentWorkspace ? (
          <div className="flex items-center gap-1">
            <WorkspaceIcon
              emoji={currentWorkspace.emoji}
              icon={currentWorkspace.icon}
              iconColor={currentWorkspace.iconColor}
              size="xs"
            />
            <Text className="text-ui-fg-subtle" size="small">
              {currentWorkspace.name}
            </Text>
          </div>
        ) : (
          <Text className="text-ui-fg-subtle" size="small">
            —
          </Text>
        )}
        <Text className="-mt-2 text-ui-fg-muted" size="xsmall">
          To move sync to a different workspace, disconnect and reconnect.
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <Text className="font-medium" size="small">
          Destination
        </Text>
        <DestinationPicker
          onChange={(next) => {
            setDestination.mutate({
              connectionId: connection._id,
              destinationCollectionId: next,
            });
          }}
          value={connection.destinationCollectionId}
          workspaceId={connection.workspaceId}
        />
      </div>

      {connection.provider === "github" ? (
        <GithubScopeEditor connection={connection} onClose={onClose} />
      ) : null}
    </div>
  );
}

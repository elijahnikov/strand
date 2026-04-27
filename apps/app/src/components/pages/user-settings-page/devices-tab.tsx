import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Heading } from "@omi/ui/heading";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ConvexError } from "convex/values";

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

function formatRelative(timestamp: number | undefined): string {
  if (!timestamp) {
    return "Never used";
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function DevicesTab() {
  const { data: tokens } = useSuspenseQuery(
    convexQuery(api.extensionAuth.queries.listMyExtensionTokens, {})
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Heading>Devices</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Active sessions for the browser extension and other connected clients.
          Revoke any you no longer recognize.
        </Text>
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Text className="text-ui-fg-subtle" size="small">
            No connected devices.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tokens.map((token) => (
            <DeviceRow key={token._id} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DeviceRowProps {
  token: {
    _id: Id<"extensionToken">;
    label: string;
    createdAt: number;
    expiresAt: number;
    lastUsedAt?: number;
  };
}

function DeviceRow({ token }: DeviceRowProps) {
  const { mutate: revoke, isPending } = useMutation({
    mutationFn: useConvexMutation(
      api.extensionAuth.mutations.revokeExtensionToken
    ),
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not revoke token",
        description: getErrorMessage(err),
      });
    },
  });

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ui-bg-subtle">
      <div className="min-w-0">
        <Text className="truncate font-medium">{token.label}</Text>
        <Text className="text-ui-fg-muted" size="small">
          Created {formatDate(token.createdAt)} · Last used{" "}
          {formatRelative(token.lastUsedAt)} · Expires{" "}
          {formatDate(token.expiresAt)}
        </Text>
      </div>
      <LoadingButton
        loading={isPending}
        onClick={() => revoke({ tokenId: token._id })}
        size="small"
        variant="secondary"
      >
        Revoke
      </LoadingButton>
    </div>
  );
}

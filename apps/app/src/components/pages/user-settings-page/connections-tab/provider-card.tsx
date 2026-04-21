import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { useMutation } from "@tanstack/react-query";
import { INTEGRATION_LOGO } from "~/components/pages/settings-page/import-tab/integration-logos";
import type { ProviderId } from "./providers";

const PROVIDER_LOGO_ID: Record<ProviderId, string> = {
  notion: "notion_oauth",
  raindrop: "raindrop_oauth",
  readwise: "readwise",
};

export type ConnectionStatus = "active" | "expired" | "error";

export interface ConnectionRow {
  _id: Id<"connection">;
  lastError?: string;
  provider: ProviderId;
  providerAccountLabel?: string;
  status: ConnectionStatus | "revoked";
}

const STATUS_VARIANT: Record<
  ConnectionStatus,
  "mono" | "destructive" | "warning"
> = {
  active: "mono",
  expired: "warning",
  error: "destructive",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  active: "Connected",
  expired: "Reconnect",
  error: "Error",
};

export function ProviderCard({
  providerId,
  label,
  description,
  connection,
  onConnect,
}: {
  providerId: ProviderId;
  label: string;
  description: string;
  connection: ConnectionRow | undefined;
  onConnect: () => void;
}) {
  const { mutate: disconnect, isPending: disconnecting } = useMutation({
    mutationFn: useConvexMutation(api.connections.mutations.disconnect),
  });

  const activeConnection =
    connection && connection.status !== "revoked" ? connection : undefined;
  const status = activeConnection?.status as ConnectionStatus | undefined;
  const Logo = INTEGRATION_LOGO[PROVIDER_LOGO_ID[providerId]];

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border-[0.5px] bg-ui-bg-component p-4">
      <div className="flex min-w-0 items-start gap-3">
        {Logo && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Logo aria-hidden="true" className="h-8 w-8" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text className="font-medium">{label}</Text>
            {status && (
              <Badge variant={STATUS_VARIANT[status]}>
                {STATUS_LABEL[status]}
              </Badge>
            )}
          </div>
          <Text className="mt-1 text-ui-fg-subtle" size="small">
            {description}
          </Text>
          {activeConnection?.providerAccountLabel && (
            <Text className="mt-2 text-ui-fg-muted" size="small">
              {activeConnection.providerAccountLabel}
            </Text>
          )}
          {status === "error" && activeConnection?.lastError && (
            <Text className="mt-2 text-ui-fg-error" size="small">
              {activeConnection.lastError}
            </Text>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {activeConnection ? (
          <>
            <Button
              data-provider={providerId}
              onClick={onConnect}
              size="small"
              variant="secondary"
            >
              Reconnect
            </Button>
            <LoadingButton
              loading={disconnecting}
              onClick={() => disconnect({ connectionId: activeConnection._id })}
              size="small"
              variant="secondary"
            >
              Disconnect
            </LoadingButton>
          </>
        ) : (
          <Button onClick={onConnect} size="small" variant="omi">
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

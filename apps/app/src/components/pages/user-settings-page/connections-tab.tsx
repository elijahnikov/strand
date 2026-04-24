import {
  convexQuery,
  useConvexAction,
  useConvexMutation,
} from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@omi/ui/dialog";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { useEffect, useMemo, useState } from "react";
import { INTEGRATION_LOGO } from "~/components/pages/settings-page/import-tab/integration-logos";

type ProviderId = "notion" | "raindrop" | "readwise";

type AuthType = "oauth2" | "api_token";

interface UiProviderDescriptor {
  authType: AuthType;
  description: string;
  id: ProviderId;
  label: string;
  tokenHelpUrl?: string;
}

const UI_PROVIDERS: UiProviderDescriptor[] = [
  {
    id: "readwise",
    label: "Readwise",
    description:
      "Import highlights from books, articles, podcasts, and tweets using an API token.",
    authType: "api_token",
    tokenHelpUrl: "https://readwise.io/access_token",
  },
  {
    id: "notion",
    label: "Notion",
    description:
      "Import pages and databases from a Notion workspace. Reconnect any time.",
    authType: "oauth2",
  },
  {
    id: "raindrop",
    label: "Raindrop.io",
    description:
      "Import bookmarks, collections, and highlights from your Raindrop account.",
    authType: "oauth2",
  },
];

const PROVIDER_LOGO_ID: Record<ProviderId, string> = {
  notion: "notion_oauth",
  raindrop: "raindrop_oauth",
  readwise: "readwise",
};

type ConnectionStatus = "active" | "expired" | "error";

interface ConnectionRow {
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

export function ConnectionsTab() {
  const { data } = useQuery(
    convexQuery(api.connections.queries.listMyConnections, {})
  );

  const [dialogProvider, setDialogProvider] =
    useState<UiProviderDescriptor | null>(null);
  const [search, setSearch] = useState("");

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return UI_PROVIDERS;
    }
    return UI_PROVIDERS.filter(
      (provider) =>
        provider.label.toLowerCase().includes(query) ||
        provider.description.toLowerCase().includes(query)
    );
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connections");
    if (!connected) {
      return;
    }
    if (connected === "error") {
      const reason = params.get("reason") ?? "unknown_error";
      toastManager.add({
        type: "error",
        title: "Could not connect",
        description: reason,
      });
    } else {
      toastManager.add({
        type: "success",
        title: "Connected",
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("connections");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const connectionsByProvider = new Map<string, ConnectionRow>(
    (data ?? [])
      .filter((c) => c.status !== "revoked")
      .map((c) => [c.provider, c as ConnectionRow])
  );

  return (
    <div className="w-full">
      <div className="mb-6">
        <Heading>Connections</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Third-party accounts for importing and (soon) syncing. Connections
          apply to your user, not this workspace.
        </Text>
      </div>
      <div className="mb-4">
        <Input
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections"
          type="search"
          value={search}
        />
      </div>
      <div className="flex flex-col gap-3">
        {filteredProviders.length === 0 ? (
          <Text className="text-ui-fg-subtle" size="small">
            No connections match your search.
          </Text>
        ) : (
          filteredProviders.map((provider) => (
            <ProviderCard
              connection={connectionsByProvider.get(provider.id)}
              description={provider.description}
              key={provider.id}
              label={provider.label}
              onConnect={() => setDialogProvider(provider)}
              providerId={provider.id}
            />
          ))
        )}
      </div>
      <ConnectDialog
        onOpenChange={(next) => {
          if (!next) {
            setDialogProvider(null);
          }
        }}
        open={dialogProvider !== null}
        provider={dialogProvider}
      />
    </div>
  );
}

function ProviderCard({
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
    <div className="flex items-center justify-between gap-4 rounded-lg p-4 hover:bg-ui-bg-component">
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

function ConnectDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: UiProviderDescriptor | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  if (!provider) {
    return null;
  }
  if (provider.authType === "oauth2") {
    return (
      <OAuthDialog
        onOpenChange={onOpenChange}
        open={open}
        provider={provider}
      />
    );
  }
  return (
    <TokenDialog onOpenChange={onOpenChange} open={open} provider={provider} />
  );
}

function OAuthDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: UiProviderDescriptor;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { mutate: getAuthorizeUrl, isPending } = useMutation({
    mutationFn: useConvexAction(
      api.connections.oauth.authorize.getAuthorizeUrl
    ),
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (err) => {
      const message =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Unknown error";
      toastManager.add({
        type: "error",
        title: `Could not start ${provider.label} connection`,
        description: message,
      });
    },
  });

  const handleRedirect = () => {
    const returnTo = `${window.location.origin}${window.location.pathname}?connections=${provider.id}`;
    getAuthorizeUrl({ provider: provider.id, returnTo });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            Connect {provider.label}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <DialogDescription>
            You'll be redirected to {provider.label} to authorize omi. After
            approving, you'll land back here.
          </DialogDescription>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Cancel
          </DialogClose>
          <LoadingButton
            loading={isPending}
            onClick={handleRedirect}
            variant="omi"
          >
            Continue to {provider.label}
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function TokenDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: UiProviderDescriptor;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [token, setToken] = useState("");

  const { mutate: connect, isPending } = useMutation({
    mutationFn: useConvexAction(api.connections.actions.connectReadwise),
    meta: { customErrorToast: true },
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: `${provider.label} connected`,
      });
      setToken("");
      onOpenChange(false);
    },
    onError: (err) => {
      const message =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Unknown error";
      toastManager.add({
        type: "error",
        title: `Could not connect ${provider.label}`,
        description: message,
      });
    },
  });

  const handleSubmit = () => {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      return;
    }
    connect({ token: trimmed });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setToken("");
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            Connect {provider.label}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <DialogDescription className="mb-4">
            Paste your {provider.label} API token.{" "}
            {provider.tokenHelpUrl && (
              <a
                className="text-ui-fg-interactive underline"
                href={provider.tokenHelpUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Get your token
              </a>
            )}
          </DialogDescription>
          <Text className="mb-1.5" size="small">
            API token
          </Text>
          <Input
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
            placeholder="readwise_xxxxxxxxxxxxxxxx"
            type="password"
            value={token}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Cancel
          </DialogClose>
          <LoadingButton
            disabled={token.trim().length === 0}
            loading={isPending}
            onClick={handleSubmit}
            variant="omi"
          >
            Connect
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

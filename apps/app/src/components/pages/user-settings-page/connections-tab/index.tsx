import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ConnectDialog } from "./connect-dialog";
import type { ConnectionRow } from "./provider-card";
import { ProviderCard } from "./provider-card";
import { UI_PROVIDERS, type UiProviderDescriptor } from "./providers";

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
        <Heading>My connections</Heading>
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

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { type ConnectTarget, McpConnectDialog } from "./mcp-connect-dialog";
import { McpLogo } from "./mcp-logos";
import { McpManageToolsDialog } from "./mcp-manage-tools-dialog";

interface MyServer {
  _id: Id<"mcpServer">;
  authType: "bearer" | "oauth2";
  cachedTools: Array<{ name: string; description: string | null }>;
  catalogId: string | null;
  enabledTools: string[];
  lastConnectedAt: number;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  name: string;
  status: "active" | "error" | "disabled" | "pending_oauth";
  toolsLastFetchedAt: number;
  url: string;
}

interface CatalogItem {
  authType: "bearer" | "oauth2";
  catalogId: string;
  connectedServerId: Id<"mcpServer"> | null;
  description: string;
  helpUrl: string | null;
  logoKey: string;
  name: string;
}

export function ConnectorsSection() {
  const { data: catalog = [] } = useQuery(
    convexQuery(api.mcpClient.queries.listCatalog, {})
  );
  const { data: servers = [] } = useQuery(
    convexQuery(api.mcpClient.queries.listMyMcpServers, {})
  );

  const [connectTarget, setConnectTarget] = useState<ConnectTarget | null>(
    null
  );
  const [manageServerId, setManageServerId] = useState<Id<"mcpServer"> | null>(
    null
  );

  const manageServer = useMemo(
    () => servers.find((s) => s._id === manageServerId) ?? null,
    [servers, manageServerId]
  );
  const customServers = useMemo(
    () => servers.filter((s) => !s.catalogId),
    [servers]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("mcp_connect");
    if (!result) {
      return;
    }
    if (result === "success") {
      toastManager.add({ type: "success", title: "MCP server connected" });
    } else {
      toastManager.add({
        type: "error",
        title: "Could not connect MCP server",
        description: params.get("reason") ?? undefined,
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("mcp_connect");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex w-full items-center gap-2">
          <Heading level="h3">Tools</Heading>
          {/* <Button
            className="ml-auto"
            onClick={() =>
              setConnectTarget({
                authType: "bearer",
                isCustom: true,
              })
            }
            size="xsmall"
            variant="secondary"
          >
            Add custom MCP server
          </Button> */}
        </div>
      </div>
      <Text className="relative -mt-3 text-ui-fg-subtle" size="xsmall">
        External MCP servers that expose tools to Omi's AI chat. Pick which
        tools are enabled when you connect.
      </Text>

      <div className="flex flex-col gap-2">
        {catalog.map((entry) => (
          <CatalogRow
            connectedServerId={entry.connectedServerId}
            entry={entry}
            key={entry.catalogId}
            onConnect={() =>
              setConnectTarget({
                catalogId: entry.catalogId,
                defaultName: entry.name,
                authType: entry.authType,
                helpUrl: entry.helpUrl ?? undefined,
                logoKey: entry.logoKey,
              })
            }
            onManage={(id) => setManageServerId(id)}
            server={
              servers.find((s) => s._id === entry.connectedServerId) ?? null
            }
          />
        ))}
        {customServers.map((s) => (
          <CustomServerRow
            key={s._id}
            onManage={() => setManageServerId(s._id)}
            server={s}
          />
        ))}
      </div>

      <McpConnectDialog
        onOpenChange={(next) => {
          if (!next) {
            setConnectTarget(null);
          }
        }}
        open={connectTarget !== null}
        target={connectTarget}
      />
      <McpManageToolsDialog
        onOpenChange={(next) => {
          if (!next) {
            setManageServerId(null);
          }
        }}
        open={manageServer !== null}
        server={manageServer}
      />
    </div>
  );
}

function CatalogRow({
  entry,
  connectedServerId,
  server,
  onConnect,
  onManage,
}: {
  entry: CatalogItem;
  connectedServerId: Id<"mcpServer"> | null;
  server: MyServer | null;
  onConnect: () => void;
  onManage: (id: Id<"mcpServer">) => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg p-4 hover:bg-ui-bg-component">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <McpLogo className="h-5 w-5" logoKey={entry.logoKey} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text className="truncate font-medium">{entry.name}</Text>
            {server?.status === "error" ? (
              <Badge size="sm" variant="warning">
                Error
              </Badge>
            ) : null}
          </div>
          {server ? (
            <Text className="text-ui-fg-muted" size="xsmall">
              {server.enabledTools.length} of {server.cachedTools.length} tools
              enabled
            </Text>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        {connectedServerId ? (
          <Button
            onClick={() => onManage(connectedServerId)}
            size="small"
            variant="secondary"
          >
            Manage
          </Button>
        ) : (
          <Button onClick={onConnect} size="small" variant="omi">
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomServerRow({
  server,
  onManage,
}: {
  server: MyServer;
  onManage: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg p-4 hover:bg-ui-bg-component">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <McpLogo className="h-5 w-5" logoKey="__custom__" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text className="truncate font-medium">{server.name}</Text>
            {server.status === "error" ? (
              <Badge size="sm" variant="warning">
                Error
              </Badge>
            ) : null}
          </div>
          <Text className="text-ui-fg-muted" size="xsmall">
            {server.enabledTools.length} of {server.cachedTools.length} tools
            enabled
          </Text>
        </div>
      </div>
      <div className="shrink-0">
        <Button onClick={onManage} size="small" variant="secondary">
          Manage
        </Button>
      </div>
    </div>
  );
}

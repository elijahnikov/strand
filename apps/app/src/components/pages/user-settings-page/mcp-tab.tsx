import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import CopyButton from "@omi/ui/copy-button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omi/ui/select";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { WorkspaceIcon } from "~/components/common/workspace-icon";

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

const TRAILING_SLASH_RE = /\/$/;
const CONVEX_CLOUD_RE = /\.convex\.cloud$/;

function getMcpEndpoint(): string {
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  if (typeof siteUrl === "string" && siteUrl.length > 0) {
    return `${siteUrl.replace(TRAILING_SLASH_RE, "")}/api/mcp`;
  }
  // Fallback: derive site URL from the cloud URL (xxx.convex.cloud →
  // xxx.convex.site). The MCP server lives on the .site host where
  // httpRouter routes are exposed, not on the .cloud function host.
  const cloudUrl = import.meta.env.VITE_CONVEX_URL;
  if (typeof cloudUrl === "string" && CONVEX_CLOUD_RE.test(cloudUrl)) {
    return `${cloudUrl.replace(CONVEX_CLOUD_RE, ".convex.site")}/api/mcp`;
  }
  return "https://YOUR-DEPLOYMENT.convex.site/api/mcp";
}

interface MintedToken {
  token: string;
  workspaceId: Id<"workspace">;
}

export function McpTab() {
  const { data: tokens = [] } = useQuery(
    convexQuery(api.mcp.tokens.listMyMcpTokens, {})
  );
  const { data: workspaces = [] } = useQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [minted, setMinted] = useState<MintedToken | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <Heading>MCP tokens</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Connect any MCP compatible client to your Omi library - Claude
            Desktop, Cursor, Windsurf, ChatGPT, custom agents, or your own
            scripts. Each token is bound to a single workspace.
          </Text>
        </div>
        <Button
          className="whitespace-nowrap"
          onClick={() => setCreateDialogOpen(true)}
          size="small"
          variant="omi"
        >
          Generate token
        </Button>
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Text className="text-ui-fg-subtle" size="small">
            No MCP tokens yet. Generate one to connect an external assistant.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tokens.map((token) => (
            <TokenRow key={token._id} token={token} />
          ))}
        </div>
      )}

      <CreateTokenDialog
        onClose={() => setCreateDialogOpen(false)}
        onMinted={setMinted}
        open={createDialogOpen}
        workspaces={workspaces.map((w) => ({
          id: w._id,
          name: w.name,
          icon: w.icon,
          emoji: w.emoji,
          iconColor: w.iconColor,
        }))}
      />

      <RevealTokenDialog minted={minted} onClose={() => setMinted(null)} />
    </div>
  );
}

interface TokenRowProps {
  token: {
    _id: Id<"extensionToken">;
    label: string;
    workspaceId: Id<"workspace"> | null;
    workspaceName: string | null;
    createdAt: number;
    expiresAt: number;
    lastUsedAt?: number;
  };
}

function TokenRow({ token }: TokenRowProps) {
  const { mutate: revoke, isPending } = useMutation({
    mutationFn: useConvexMutation(api.mcp.tokens.revokeMcpToken),
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
          {token.workspaceName ?? "Unknown workspace"} · Created{" "}
          {formatDate(token.createdAt)} · Last used{" "}
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

interface CreateTokenDialogProps {
  onClose: () => void;
  onMinted: (minted: MintedToken) => void;
  open: boolean;
  workspaces: Array<{
    id: Id<"workspace">;
    name: string;
    icon?: string;
    emoji?: string;
    iconColor?: string;
  }>;
}

function CreateTokenDialog({
  open,
  onClose,
  onMinted,
  workspaces,
}: CreateTokenDialogProps) {
  const [label, setLabel] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>(
    workspaces[0]?.id ?? ""
  );

  const { mutate: mint, isPending } = useMutation({
    mutationFn: useConvexMutation(api.mcp.tokens.mintMcpToken),
    onSuccess: (result: { token: string; workspaceId: Id<"workspace"> }) => {
      onMinted({
        token: result.token,
        workspaceId: result.workspaceId,
      });
      setLabel("");
      onClose();
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not generate token",
        description: getErrorMessage(err),
      });
    },
  });

  const handleSubmit = () => {
    if (!(label.trim() && workspaceId)) {
      return;
    }
    mint({
      label: label.trim(),
      workspaceId: workspaceId as Id<"workspace">,
    });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogPopup>
        <DialogHeader>
          <div className="flex flex-col items-start">
            <DialogTitle className="whitespace-nowrap text-sm">
              Generate MCP token
            </DialogTitle>
            <DialogDescription className="text-xs">
              The token will be shown once. Copy it into your MCP client's
              configuration before closing the next dialog.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-5">
          <div className="flex flex-col gap-2">
            <Text className="font-medium" size="small">
              Label
            </Text>
            <Input
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Claude Desktop on MacBook"
              value={label}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Text className="font-medium" size="small">
              Workspace
            </Text>
            <Select
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setWorkspaceId(value);
                }
              }}
              value={workspaceId}
            >
              <SelectTrigger>
                <SelectValue>
                  {(() => {
                    const ws = workspaces.find((w) => w.id === workspaceId);
                    if (!ws) {
                      return "Select workspace";
                    }
                    return (
                      <span className="flex items-center gap-2">
                        <WorkspaceIcon
                          emoji={ws.emoji}
                          icon={ws.icon}
                          iconColor={ws.iconColor}
                          size="xs"
                        />
                        <span>{ws.name}</span>
                      </span>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex items-center gap-2">
                      <WorkspaceIcon
                        emoji={w.emoji}
                        icon={w.icon}
                        iconColor={w.iconColor}
                        size="xs"
                      />
                      <span>{w.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Text className="text-ui-fg-muted" size="xsmall">
              Tool calls made with this token will only see this workspace.
            </Text>
          </div>
        </div>

        <DialogFooter>
          <DialogClose>
            <Button size="small" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            disabled={!(label.trim() && workspaceId)}
            loading={isPending}
            onClick={handleSubmit}
            size="small"
            variant="omi"
          >
            Generate
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

interface RevealTokenDialogProps {
  minted: MintedToken | null;
  onClose: () => void;
}

function RevealTokenDialog({ minted, onClose }: RevealTokenDialogProps) {
  const endpoint = getMcpEndpoint();
  const configSnippet = minted
    ? JSON.stringify(
        {
          mcpServers: {
            omi: {
              url: endpoint,
              headers: { Authorization: `Bearer ${minted.token}` },
            },
          },
        },
        null,
        2
      )
    : "";

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={Boolean(minted)}
    >
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col items-start">
            <DialogTitle className="whitespace-nowrap text-sm">
              Token generated
            </DialogTitle>
            <DialogDescription className="text-xs">
              This is the only time the token will be shown. Copy it now.
            </DialogDescription>
          </div>
        </DialogHeader>

        {minted ? (
          <div className="flex flex-col gap-4 px-4 py-5">
            <Text className="-mb-2 font-medium" size="small">
              Token
            </Text>
            <div className="flex items-center gap-2 rounded-md border bg-ui-bg-subtle p-3 font-mono text-xs">
              <span className="grow truncate">{minted.token}</span>
              <CopyButton text={minted.token} />
            </div>

            <div className="flex flex-col gap-2">
              <Text className="font-medium" size="small">
                Endpoint
              </Text>
              <div className="flex items-center gap-2 rounded-md border bg-ui-bg-subtle p-3 font-mono text-xs">
                <span className="grow truncate">{endpoint}</span>
                <CopyButton text={endpoint} />
              </div>
              <Text className="text-ui-fg-muted" size="xsmall">
                Use <code>Authorization: Bearer &lt;token&gt;</code> on every
                request. The endpoint speaks the MCP Streamable HTTP transport,
                so any MCP client works.
              </Text>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              <Text className="font-medium" size="small">
                Standard MCP config block
              </Text>
              <Text className="text-ui-fg-muted" size="xsmall">
                Most MCP clients (Claude Desktop, Cursor, Windsurf, etc.) accept
                this shape in their config file.
              </Text>
              <div className="relative rounded-md border bg-ui-bg-subtle">
                <div className="absolute top-2 right-2">
                  <CopyButton text={configSnippet} />
                </div>
                <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs">
                  {configSnippet}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose>
            <Button size="small" variant="default">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

import { useConvexAction } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
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
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { McpLogo } from "./mcp-logos";
import { toErrorMessage } from "./shared";

export interface ConnectTarget {
  authType: "bearer" | "oauth2";
  catalogId?: string;
  defaultName?: string;
  defaultUrl?: string;
  helpUrl?: string;
  isCustom?: boolean;
  logoKey?: string;
}

export function McpConnectDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ConnectTarget | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [authType, setAuthType] = useState<"bearer" | "oauth2">("bearer");

  useEffect(() => {
    if (target) {
      setName(target.defaultName ?? "");
      setUrl(target.defaultUrl ?? "");
      setAuthType(target.authType);
      setToken("");
    }
  }, [target]);

  const connectBearerAction = useConvexAction(
    api.mcpClient.connectActions.connectBearerServer
  );
  const startOauthAction = useConvexAction(
    api.mcpClient.oauthActions.startOauthConnect
  );

  const { mutate: connectBearer, isPending: isConnectingBearer } = useMutation({
    mutationFn: connectBearerAction,
    onSuccess: (result: {
      serverId: Id<"mcpServer">;
      tools: Array<{ name: string }>;
    }) => {
      toastManager.add({
        type: "success",
        title: "Connected",
        description: `${result.tools.length} tools available`,
      });
      onOpenChange(false);
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Connect failed",
        description: toErrorMessage(err),
      });
    },
  });

  const { mutate: startOauth, isPending: isStartingOauth } = useMutation({
    mutationFn: startOauthAction,
    onSuccess: (result: { authorizationUrl: string }) => {
      window.location.href = result.authorizationUrl;
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not start OAuth",
        description: toErrorMessage(err),
      });
    },
  });

  if (!target) {
    return null;
  }

  const isCatalog = !target.isCustom;
  const showName = target.isCustom;
  const showUrl = target.isCustom;
  const showAuthMethodPicker = target.isCustom;
  const showToken = authType === "bearer";
  const isLoading = isConnectingBearer || isStartingOauth;

  const canSubmit =
    (target.isCustom
      ? name.trim().length > 0 && url.trim().length > 0
      : true) &&
    (authType !== "bearer" || token.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    // For catalog items, leave name/url undefined so the backend resolves
    // them from the catalog entry. Sending empty strings would bypass the
    // backend's `??` fallback and fail validation.
    const customName = target.isCustom ? name.trim() : undefined;
    const customUrl = target.isCustom ? url.trim() : undefined;
    if (authType === "bearer") {
      connectBearer({
        catalogId: target.catalogId,
        name: customName,
        url: customUrl,
        token: token.trim(),
      });
    } else {
      const base = window.location.href.split("?")[0] ?? window.location.href;
      startOauth({
        catalogId: target.catalogId,
        name: customName,
        url: customUrl,
        returnTo: `${base}?tab=connections`,
      });
    }
  };

  const titleLabel = target.isCustom
    ? "Add custom MCP server"
    : `Connect ${target.defaultName ?? "MCP server"}`;
  const description =
    isCatalog && authType === "oauth2"
      ? `Continue to ${target.defaultName} to authorize Omi. Tools become available in chat once you return.`
      : isCatalog && authType === "bearer"
        ? `Paste a personal access token from ${target.defaultName}. We'll fetch its tool list and let you pick which to enable.`
        : "Connect any MCP-compatible server. We'll probe its tool list once you save.";

  const submitLabel =
    authType === "oauth2"
      ? `Continue to ${target.defaultName ?? "authorize"}`
      : "Connect";

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        }
      }}
      open={open}
    >
      <DialogPopup>
        <DialogHeader>
          <div className="flex flex-col items-start">
            <DialogTitle className="whitespace-nowrap text-sm">
              {titleLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-5">
          {isCatalog && target.logoKey ? (
            <div className="flex items-center gap-3 rounded-lg border bg-ui-bg-subtle p-3">
              <McpLogo className="h-6 w-6 shrink-0" logoKey={target.logoKey} />
              <div className="min-w-0">
                <Text className="font-medium" size="small">
                  {target.defaultName}
                </Text>
                <Text className="text-ui-fg-muted" size="xsmall">
                  {authType === "oauth2" ? "OAuth 2.1" : "Bearer token"}
                </Text>
              </div>
            </div>
          ) : null}

          {showAuthMethodPicker ? (
            <div className="flex flex-col gap-2">
              <Text className="font-medium" size="small">
                Auth method
              </Text>
              <Select
                onValueChange={(value) => {
                  if (value === "bearer" || value === "oauth2") {
                    setAuthType(value);
                  }
                }}
                value={authType}
              >
                <SelectTrigger>
                  <SelectValue>
                    {authType === "oauth2" ? "OAuth 2.1" : "Bearer token"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showName ? (
            <div className="flex flex-col gap-2">
              <Text className="font-medium" size="small">
                Name
              </Text>
              <Input
                onChange={(e) => setName(e.target.value)}
                placeholder="My internal MCP"
                value={name}
              />
            </div>
          ) : null}

          {showUrl ? (
            <div className="flex flex-col gap-2">
              <Text className="font-medium" size="small">
                Server URL
              </Text>
              <Input
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/v1"
                value={url}
              />
            </div>
          ) : null}

          {showToken ? (
            <div className="flex flex-col gap-2">
              <Text className="font-medium" size="small">
                API token
              </Text>
              <Input
                onChange={(e) => setToken(e.target.value)}
                placeholder="lin_api_..."
                type="password"
                value={token}
              />
              {target.helpUrl ? (
                <Text className="text-ui-fg-muted" size="xsmall">
                  Get a token at{" "}
                  <a
                    className="underline"
                    href={target.helpUrl}
                    rel="noopener"
                    target="_blank"
                  >
                    {target.helpUrl}
                  </a>
                </Text>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose>
            <Button size="small" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            disabled={!canSubmit}
            loading={isLoading}
            onClick={handleSubmit}
            size="small"
            variant="omi"
          >
            {submitLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

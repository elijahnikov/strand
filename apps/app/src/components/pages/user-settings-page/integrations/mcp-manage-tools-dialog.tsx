import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Checkbox } from "@omi/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@omi/ui/dialog";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toErrorMessage } from "./shared";

interface ServerSnapshot {
  _id: Id<"mcpServer">;
  cachedTools: Array<{ name: string; description: string | null }>;
  enabledTools: string[];
  name: string;
}

export function McpManageToolsDialog({
  server,
  open,
  onOpenChange,
}: {
  server: ServerSnapshot | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (server) {
      setEnabled(new Set(server.enabledTools));
    }
  }, [server]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: useConvexMutation(api.mcpClient.mutations.setEnabledTools),
    onSuccess: () => {
      toastManager.add({ type: "success", title: "Tools updated" });
      onOpenChange(false);
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not update tools",
        description: toErrorMessage(err),
      });
    },
  });

  const { mutate: disconnect, isPending: isDisconnecting } = useMutation({
    mutationFn: useConvexMutation(api.mcpClient.mutations.disconnectMcpServer),
    onSuccess: () => {
      toastManager.add({ type: "success", title: "Disconnected" });
      onOpenChange(false);
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Disconnect failed",
        description: toErrorMessage(err),
      });
    },
  });

  const refreshAction = useConvexAction(
    api.mcpClient.connectActions.refreshTools
  );
  const { mutate: refresh, isPending: isRefreshing } = useMutation({
    mutationFn: refreshAction,
    onSuccess: (result: {
      added: string[];
      removed: string[];
      total: number;
    }) => {
      const parts: string[] = [];
      if (result.added.length > 0) {
        parts.push(`+${result.added.length} new`);
      }
      if (result.removed.length > 0) {
        parts.push(`-${result.removed.length} removed`);
      }
      toastManager.add({
        type: "success",
        title: "Tools refreshed",
        description:
          parts.length > 0 ? parts.join(", ") : `${result.total} tools`,
      });
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Refresh failed",
        description: toErrorMessage(err),
      });
    },
  });

  if (!server) {
    return null;
  }

  const handleToggle = (toolName: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

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
              {server.name} tools
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pick which tools the AI chat is allowed to invoke on this server.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 pt-5">
          <div className="flex items-center justify-between">
            <Text className="text-ui-fg-muted" size="xsmall">
              {enabled.size} of {server.cachedTools.length} enabled
            </Text>
            <LoadingButton
              loading={isRefreshing}
              onClick={() => refresh({ serverId: server._id })}
              size="small"
              variant="secondary"
            >
              Refresh tools
            </LoadingButton>
          </div>

          <div className="-mx-4 max-h-[60vh] overflow-y-auto">
            {server.cachedTools.length === 0 ? (
              <div className="mx-4 rounded-lg border border-dashed p-6 text-center">
                <Text className="text-ui-fg-subtle" size="small">
                  Server has no tools yet. Click Refresh.
                </Text>
              </div>
            ) : (
              <div className="flex flex-col gap-1 px-4">
                {server.cachedTools.map((tool) => (
                  <button
                    className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-left hover:bg-ui-bg-subtle"
                    key={tool.name}
                    onClick={() => handleToggle(tool.name)}
                    type="button"
                  >
                    <Checkbox
                      checked={enabled.has(tool.name)}
                      className="mt-0.5"
                      onCheckedChange={() => handleToggle(tool.name)}
                    />
                    <div className="min-w-0">
                      <Text className="font-medium font-mono" size="small">
                        {tool.name}
                      </Text>
                      {tool.description ? (
                        <Text className="text-ui-fg-subtle" size="xsmall">
                          {tool.description}
                        </Text>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="justify-between">
          <LoadingButton
            loading={isDisconnecting}
            onClick={() => disconnect({ serverId: server._id })}
            size="small"
            variant="destructive"
          >
            Disconnect
          </LoadingButton>
          <div className="flex gap-2">
            <DialogClose>
              <Button size="small" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              loading={isSaving}
              onClick={() =>
                save({
                  serverId: server._id,
                  toolNames: Array.from(enabled),
                })
              }
              size="small"
              variant="omi"
            >
              Save
            </LoadingButton>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

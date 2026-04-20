import { useConvexAction } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import { Button } from "@strand/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@strand/ui/dialog";
import { Input } from "@strand/ui/input";
import { LoadingButton } from "@strand/ui/loading-button";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { useState } from "react";
import type { UiProviderDescriptor } from "./providers";

export function ConnectDialog({
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
            You'll be redirected to {provider.label} to authorize Strand. After
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
            variant="strand"
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
            variant="strand"
          >
            Connect
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

import {
  convexQuery,
  useConvexAction,
  useConvexMutation,
} from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { Button } from "@omi/ui/button";
import {
  Dialog,
  DialogClose,
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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { useState } from "react";

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

export function AccountTab() {
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );
  const user = data.user;
  const navigate = useNavigate();

  const [deleteOpen, setDeleteOpen] = useState(false);

  const { mutateAsync: exportData, isPending: exporting } = useMutation({
    mutationFn: useConvexAction(api.user.actions.exportData),
  });

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  const handleExport = async () => {
    try {
      const result = await exportData({});
      window.open(result.url, "_blank", "noopener,noreferrer");
      toastManager.add({
        type: "success",
        title: "Export ready",
        description: "Your data has been opened in a new tab.",
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not export data",
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <Heading>Account</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Sign out, export your data, or permanently delete your account.
        </Text>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
        <div className="min-w-0">
          <Text className="font-medium">Sign out</Text>
          <Text className="text-ui-fg-subtle" size="small">
            End your session on this device.
          </Text>
        </div>
        <Button onClick={handleSignOut} size="small" variant="secondary">
          Sign out
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
        <div className="min-w-0">
          <Text className="font-medium">Export data</Text>
          <Text className="text-ui-fg-subtle" size="small">
            Download a JSON file with your workspaces, resources, collections,
            and tags.
          </Text>
        </div>
        <LoadingButton
          loading={exporting}
          onClick={handleExport}
          size="small"
          variant="secondary"
        >
          Export
        </LoadingButton>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border-[0.5px] border-ui-border-error bg-ui-bg-field p-4">
        <div className="min-w-0">
          <Text className="font-medium text-ui-fg-error">Delete account</Text>
          <Text className="text-ui-fg-subtle" size="small">
            Permanently delete your account, owned workspaces, and all
            associated data. This cannot be undone.
          </Text>
        </div>
        <Button
          onClick={() => setDeleteOpen(true)}
          size="small"
          variant="destructive"
        >
          Delete
        </Button>
      </div>

      <DeleteAccountDialog
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        username={user.username}
      />
    </div>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  username,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  username: string;
}) {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");

  const { mutateAsync: deleteAccount, isPending } = useMutation({
    mutationFn: useConvexMutation(api.user.mutations.deleteAccount),
  });

  const reset = () => setConfirmation("");

  const handleConfirm = async () => {
    if (confirmation !== username) {
      return;
    }
    try {
      await deleteAccount({});
      await authClient.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not delete account",
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogPopup className="max-w-md!">
        <DialogHeader>
          <DialogTitle className="font-medium text-sm">
            Delete account
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-4">
          <Text size="small">
            This permanently deletes your account, all workspaces you solely
            own, and all associated resources, collections, and tags. Workspaces
            you share with others will lose your membership but remain available
            to other members.
          </Text>
          <Text size="small">
            Type{" "}
            <span className="rounded bg-ui-bg-subtle px-1 font-mono">
              {username}
            </span>{" "}
            to confirm.
          </Text>
          <Input
            autoComplete="off"
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={username}
            value={confirmation}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Cancel
          </DialogClose>
          <LoadingButton
            disabled={confirmation !== username}
            loading={isPending}
            onClick={handleConfirm}
            variant="destructive"
          >
            Delete account
          </LoadingButton>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

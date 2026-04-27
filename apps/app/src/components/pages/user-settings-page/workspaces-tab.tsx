import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import {
  ExternalLinkIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { WorkspaceIcon } from "~/components/common/workspace-icon/workspace-icon";
import { WorkspaceIconSelector } from "~/components/common/workspace-icon/workspace-icon-selector";

type IconState =
  | { type: "icon"; name: string; color: string }
  | { type: "emoji"; emoji: string }
  | { type: "none" };

type Role = "owner" | "admin" | "member";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

export function WorkspacesTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Heading>Workspaces</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Create new workspaces and manage the ones you belong to
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        <Heading className="text-sm" level="h3">
          Create new
        </Heading>
        <CreateWorkspaceForm />
      </div>

      <div className="mt-3 space-y-2">
        <Heading className="text-sm" level="h3">
          Your workspaces
        </Heading>
        <WorkspacesList />
      </div>
    </div>
  );
}

function CreateWorkspaceForm() {
  const [name, setName] = useState("");
  const [iconState, setIconState] = useState<IconState>({ type: "none" });
  const [error, setError] = useState<string | null>(null);

  const { mutate: createWorkspace, isPending } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.create),
    onSuccess: () => {
      setName("");
      setIconState({ type: "none" });
      setError(null);
      toastManager.add({
        type: "success",
        title: "Workspace created",
      });
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
    meta: { customErrorToast: true },
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createWorkspace({
      name: trimmed,
      emoji: iconState.type === "emoji" ? iconState.emoji : undefined,
      icon: iconState.type === "icon" ? iconState.name : undefined,
      iconColor: iconState.type === "icon" ? iconState.color : undefined,
    });
  };

  return (
    <div>
      <form className="flex items-center gap-2" onSubmit={handleSubmit}>
        <WorkspaceIconSelector
          currentEmoji={
            iconState.type === "emoji" ? iconState.emoji : undefined
          }
          currentIcon={iconState.type === "icon" ? iconState.name : undefined}
          currentIconColor={
            iconState.type === "icon" ? iconState.color : undefined
          }
          onSelect={(value) => setIconState(value)}
        >
          <div className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed hover:bg-ui-bg-component">
            <WorkspaceIcon
              emoji={iconState.type === "emoji" ? iconState.emoji : undefined}
              icon={iconState.type === "icon" ? iconState.name : undefined}
              iconColor={
                iconState.type === "icon" ? iconState.color : undefined
              }
              size="md"
            />
          </div>
        </WorkspaceIconSelector>
        <div className="flex-1">
          <Input
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Workspace name"
            value={name}
          />
          {error && <p className="mt-1 text-destructive text-xs">{error}</p>}
        </div>
        <LoadingButton
          disabled={!name.trim()}
          loading={isPending}
          type="submit"
          variant="omi"
        >
          <PlusIcon className="size-3 shrink-0" />
          Create
        </LoadingButton>
      </form>
    </div>
  );
}

function WorkspacesList() {
  const { data: workspaces } = useSuspenseQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );

  if (workspaces.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {workspaces.map((workspace) => (
        <WorkspaceRow key={workspace._id} workspace={workspace} />
      ))}
    </div>
  );
}

interface WorkspaceRowProps {
  workspace: {
    _id: Id<"workspace">;
    name: string;
    role: Role;
    emoji?: string;
    icon?: string;
    iconColor?: string;
  };
}

function WorkspaceRow({ workspace }: WorkspaceRowProps) {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"leave" | "delete" | null>(
    null
  );

  const { mutate: leaveWorkspace } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.leaveWorkspace),
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not leave workspace",
        description: getErrorMessage(err),
      });
    },
  });

  const { mutate: deleteWorkspace } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.deleteWorkspace),
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not delete workspace",
        description: getErrorMessage(err),
      });
    },
  });

  const handleOpen = () =>
    navigate({
      to: "/workspace/$workspaceId",
      params: { workspaceId: workspace._id },
    });

  const handleConfirm = () => {
    if (confirmAction === "leave") {
      leaveWorkspace({ workspaceId: workspace._id });
    } else if (confirmAction === "delete") {
      deleteWorkspace({ workspaceId: workspace._id });
    }
    setConfirmAction(null);
  };

  const isOwner = workspace.role === "owner";

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ui-bg-subtle">
      <div className="flex items-center gap-3">
        <WorkspaceIcon
          emoji={workspace.emoji}
          icon={workspace.icon}
          iconColor={workspace.iconColor}
          size="md"
        />
        <Text>{workspace.name}</Text>
      </div>
      <div className="flex items-center gap-2">
        <Badge size="default" variant="mono">
          {ROLE_LABELS[workspace.role]}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-7 items-center justify-center rounded-md hover:bg-ui-bg-subtle-hover"
            render={<button type="button" />}
          >
            <MoreHorizontalIcon className="size-4 text-ui-fg-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onClick={handleOpen}>
              <ExternalLinkIcon className="size-4" />
              Open
            </DropdownMenuItem>
            {!isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setConfirmAction("leave")}
                >
                  <LogOutIcon className="size-4" />
                  Leave workspace
                </DropdownMenuItem>
              </>
            )}
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setConfirmAction("delete")}
                >
                  <TrashIcon className="size-4" />
                  Delete workspace
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
        open={confirmAction !== null}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "leave"
                ? "Leave workspace"
                : "Delete workspace"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <DialogDescription>
              {confirmAction === "leave" ? (
                <>
                  Leave <span className="font-medium">{workspace.name}</span>?
                  You'll lose access to all resources in this workspace.
                </>
              ) : (
                <>
                  Permanently delete{" "}
                  <span className="font-medium">{workspace.name}</span> and all
                  of its resources, collections, and tags? This cannot be
                  undone.
                </>
              )}
            </DialogDescription>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleConfirm} variant="destructive">
              {confirmAction === "leave" ? "Leave" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

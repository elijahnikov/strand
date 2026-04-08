import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Heading } from "@strand/ui/heading";
import { Input } from "@strand/ui/input";
import { LoadingButton } from "@strand/ui/loading-button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@strand/ui/select";
import { Text } from "@strand/ui/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import {
  MoreHorizontalIcon,
  SendIcon,
  ShieldIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { UserAvatar } from "~/components/common/user-avatar";

type MemberRole = "owner" | "admin" | "member";

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const _ROLE_VARIANTS: Record<MemberRole, "default" | "secondary" | "outline"> =
  {
    owner: "default",
    admin: "secondary",
    member: "outline",
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

interface MembersTabProps {
  currentUserRole: MemberRole | undefined;
  workspaceId: Id<"workspace">;
}

export function MembersTab({ workspaceId, currentUserRole }: MembersTabProps) {
  const isAdminOrOwner =
    currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Heading>Members</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Invite and manage workspace members
        </Text>
      </div>
      {isAdminOrOwner && (
        <div className="flex flex-col gap-3">
          <Heading className="text-sm" level="h3">
            Invites
          </Heading>
          <InviteForm workspaceId={workspaceId} />
          <PendingInvitations workspaceId={workspaceId} />
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Heading className="text-sm" level="h3">
          Members
        </Heading>
        <MembersList
          currentUserRole={currentUserRole}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}

function InviteForm({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);

  const { mutate: createInvitation, isPending } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.createInvitation),
    onSuccess: () => {
      setEmail("");
      setError(null);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      return;
    }
    createInvitation({ workspaceId, email: email.trim(), role });
  };

  return (
    <div>
      <form className="flex items-center gap-2" onSubmit={handleSubmit}>
        <div className="flex-1">
          <Input
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="Email address"
            type="email"
            value={email}
          />
          {error && <p className="mt-1 text-destructive text-xs">{error}</p>}
        </div>
        <Select
          onValueChange={(val) => setRole(val as "admin" | "member")}
          value={role}
        >
          <SelectTrigger className="w-28">
            <SelectValue>{`${role.charAt(0).toLocaleUpperCase()}${role.substring(1)}`}</SelectValue>
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectPopup>
        </Select>
        <LoadingButton
          disabled={!email.trim()}
          loading={isPending}
          type="submit"
          variant={"strand"}
        >
          <SendIcon className="size-3 shrink-0" />
          Invite
        </LoadingButton>
      </form>
    </div>
  );
}

function PendingInvitations({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { data: invitations } = useQuery(
    convexQuery(api.workspace.queries.listInvitationsByWorkspace, {
      workspaceId,
    })
  );

  const { mutate: revokeInvitation } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.revokeInvitation),
  });

  if (!invitations?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {invitations.map((invite) => (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ui-bg-subtle"
          key={invite._id}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-ui-bg-subtle">
              <SendIcon className="size-3.5 text-ui-fg-muted" />
            </div>
            <div>
              <Text>{invite.invitedEmail}</Text>
              <Text className="font-medium text-ui-fg-muted text-xs">
                Invited by {invite.inviterName}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={"mono"}>{ROLE_LABELS[invite.role]}</Badge>
            <Button
              className="size-5"
              onClick={() =>
                revokeInvitation({
                  workspaceId,
                  invitationId: invite._id,
                })
              }
              size="small"
              variant="ghost"
            >
              <XIcon className="size-3.5 shrink-0" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MembersList({
  workspaceId,
  currentUserRole,
}: {
  workspaceId: Id<"workspace">;
  currentUserRole: MemberRole | undefined;
}) {
  const { data: members } = useQuery(
    convexQuery(api.workspace.queries.listMembers, {
      workspaceId,
    })
  );

  const { mutate: updateRole } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.updateRole),
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.removeMember),
  });

  const [confirmRemove, setConfirmRemove] = useState<{
    memberId: Id<"workspaceMember">;
    username: string;
  } | null>(null);

  const handleRemove = useCallback(() => {
    if (!confirmRemove) {
      return;
    }
    removeMember({
      workspaceId,
      memberId: confirmRemove.memberId,
    });
    setConfirmRemove(null);
  }, [confirmRemove, removeMember, workspaceId]);

  if (!members) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-col gap-1">
        {members.map((member) => (
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ui-bg-subtle"
            key={member._id}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                className="size-8"
                image={member.image}
                name={member.username}
              />
              <div className="flex flex-col -space-y-1">
                <Text>{member.username}</Text>
                <Text className="font-mono text-ui-fg-muted text-xs">
                  {member.email}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge size="default" variant={"mono"}>
                {ROLE_LABELS[member.role]}
              </Badge>
              {currentUserRole === "owner" && member.role !== "owner" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex size-7 items-center justify-center rounded-md hover:bg-ui-bg-subtle-hover"
                    render={<button type="button" />}
                  >
                    <MoreHorizontalIcon className="size-4 text-ui-fg-muted" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    {member.role === "member" && (
                      <DropdownMenuItem
                        onClick={() =>
                          updateRole({
                            workspaceId,
                            memberId: member._id,
                            role: "admin",
                          })
                        }
                      >
                        <ShieldIcon className="size-4" />
                        Make admin
                      </DropdownMenuItem>
                    )}
                    {member.role === "admin" && (
                      <DropdownMenuItem
                        onClick={() =>
                          updateRole({
                            workspaceId,
                            memberId: member._id,
                            role: "member",
                          })
                        }
                      >
                        <UserIcon className="size-4" />
                        Make member
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        setConfirmRemove({
                          memberId: member._id,
                          username: member.username,
                        })
                      }
                    >
                      <XIcon className="size-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {currentUserRole === "admin" && member.role === "member" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex size-7 items-center justify-center rounded-md hover:bg-ui-bg-subtle-hover"
                    render={<button type="button" />}
                  >
                    <MoreHorizontalIcon className="size-4 text-ui-fg-muted" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        setConfirmRemove({
                          memberId: member._id,
                          username: member.username,
                        })
                      }
                    >
                      <XIcon className="size-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRemove(null);
          }
        }}
        open={!!confirmRemove}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{confirmRemove?.username}</span>{" "}
              from this workspace? They will lose access to all resources.
            </DialogDescription>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleRemove} variant="destructive">
              Remove
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

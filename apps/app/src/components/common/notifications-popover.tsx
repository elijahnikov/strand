import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { RiNotification3Fill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import { Badge } from "@strand/ui/badge";
import { LoadingButton } from "@strand/ui/loading-button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@strand/ui/popover";
import { Text } from "@strand/ui/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "lucide-react";
export function NotificationsPopover() {
  const { data: invitations } = useQuery(
    convexQuery(api.workspace.queries.listPendingInvitationsForUser, {})
  );

  const { mutate: acceptInvitation, isPending: isAccepting } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.acceptInvitation),
  });

  const { mutate: declineInvitation, isPending: isDeclining } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.declineInvitation),
  });

  const count = invitations?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        className="relative flex size-8 items-center justify-center rounded-full text-ui-fg-muted hover:bg-accent hover:text-ui-fg-base"
        render={<button type="button" />}
      >
        <RiNotification3Fill className="size-3.5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl bg-ui-bg-component p-0"
        side="right"
        sideOffset={6}
      >
        <div className="border-b px-3 py-2.5">
          <PopoverTitle className="font-medium text-sm">
            Notifications
          </PopoverTitle>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {count === 0 ? (
            <div className="px-3 py-6 text-center text-ui-fg-muted text-xs">
              No notifications
            </div>
          ) : (
            invitations?.map((invite) => (
              <div
                className="flex flex-col gap-2 border-b px-3 py-3 last:border-b-0"
                key={invite._id}
              >
                <div>
                  <span className="flex items-center gap-x-1 text-sm">
                    <Text className="font-medium">{invite.inviterName}</Text>{" "}
                    <Text className="text-ui-fg-subtle">invited you to </Text>
                    <Text className="font-medium">{invite.workspaceName}</Text>
                    <Text className="text-ui-fg-subtle">as</Text>
                    <Badge variant="mono">
                      {invite.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </span>
                </div>
                <div className="flex gap-2">
                  <LoadingButton
                    className="flex-1"
                    loading={isAccepting}
                    onClick={() =>
                      acceptInvitation({ invitationId: invite._id })
                    }
                    size="small"
                    variant="strand"
                  >
                    <CheckIcon className="size-3.5" />
                    Accept
                  </LoadingButton>
                  <LoadingButton
                    className="flex-1"
                    loading={isDeclining}
                    onClick={() =>
                      declineInvitation({ invitationId: invite._id })
                    }
                    size="small"
                    variant="secondary"
                  >
                    <XIcon className="size-3.5" />
                    Decline
                  </LoadingButton>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

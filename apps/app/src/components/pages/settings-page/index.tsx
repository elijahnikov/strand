import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import {
  RiBarChartHorizontalFill,
  RiBrain2Fill,
  RiGroupFill,
  RiSettings3Fill,
  RiShieldKeyholeFill,
} from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@strand/ui/form";
import { Heading } from "@strand/ui/heading";
import { Input } from "@strand/ui/input";
import { LoadingButton } from "@strand/ui/loading-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@strand/ui/tabs";
import { Text } from "@strand/ui/text";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PageContent } from "~/components/common/page-content";
import {
  WorkspaceIcon,
  WorkspaceIconSelector,
} from "~/components/common/workspace-icon";
import { MembersTab } from "./members-tab";
import { MemoryTab } from "./memory-tab";

export function SettingsPageComponent({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { data } = useSuspenseQuery(
    convexQuery(api.workspace.queries.getById, { workspaceId })
  );

  return (
    <PageContent className="mt-8 h-[calc(95vh-80px)] py-8" width="xl:w-2/3">
      <Heading className="mb-8 text-xl">Workspace settings</Heading>
      <Tabs className="h-full" defaultValue="general" orientation="vertical">
        <TabsList className="h-full w-44 shrink-0 items-start justify-start self-start">
          <TabsTrigger className="grow-0 pl-3" value="general">
            <RiSettings3Fill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              General
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="usage">
            <RiBarChartHorizontalFill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Usage
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="members">
            <RiGroupFill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Members
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="memory">
            <RiBrain2Fill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Memory
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="advanced">
            <RiShieldKeyholeFill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Advanced
            </Text>
          </TabsTrigger>
        </TabsList>
        <div className="w-full border-l-[0.5px]">
          <TabsContent className="pl-8" value="general">
            <GeneralTab
              isAdminOrOwner={
                data.member?.role === "owner" || data.member?.role === "admin"
              }
              workspace={data.workspace}
              workspaceId={workspaceId}
            />
          </TabsContent>
          <TabsContent className="pl-8" value="members">
            <MembersTab
              currentUserRole={data.member?.role}
              workspaceId={workspaceId}
            />
          </TabsContent>
          <TabsContent className="pl-8" value="memory">
            <MemoryTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent className="pl-8" value="advanced">
            <AdvancedTab
              isOwner={data.member?.role === "owner"}
              workspaceId={workspaceId}
              workspaceName={data.workspace.name}
            />
          </TabsContent>
        </div>
      </Tabs>
    </PageContent>
  );
}

interface WorkspaceFormValues {
  emoji?: string;
  icon?: string;
  iconColor?: string;
  name: string;
}

function GeneralTab({
  workspaceId,
  workspace,
  isAdminOrOwner,
}: {
  workspaceId: Id<"workspace">;
  workspace: {
    name: string;
    icon?: string;
    iconColor?: string;
    emoji?: string;
  };
  isAdminOrOwner: boolean;
}) {
  const form = useForm<WorkspaceFormValues>({
    defaultValues: {
      name: workspace.name,
      icon: workspace.icon,
      iconColor: workspace.iconColor,
      emoji: workspace.emoji,
    },
  });

  useEffect(() => {
    form.reset({
      name: workspace.name,
      icon: workspace.icon,
      iconColor: workspace.iconColor,
      emoji: workspace.emoji,
    });
  }, [
    workspace.name,
    workspace.icon,
    workspace.iconColor,
    workspace.emoji,
    form,
  ]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.update),
    onSuccess: () => {
      form.reset(form.getValues());
    },
  });

  const watchedIcon = form.watch("icon");
  const watchedIconColor = form.watch("iconColor");
  const watchedEmoji = form.watch("emoji");

  return (
    <div className="w-full">
      <div className="mb-8">
        <Heading>General</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Manage your workspace
        </Text>
      </div>
      <Form {...form}>
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={form.handleSubmit((values) =>
            save({
              workspaceId,
              name: values.name,
              icon: values.icon,
              iconColor: values.iconColor,
              emoji: values.emoji,
            })
          )}
        >
          <div className="flex items-center gap-3">
            {isAdminOrOwner ? (
              <WorkspaceIconSelector
                currentEmoji={watchedEmoji}
                currentIcon={watchedIcon}
                currentIconColor={watchedIconColor}
                onSelect={(value) => {
                  if (value.type === "emoji") {
                    form.setValue("emoji", value.emoji, {
                      shouldDirty: true,
                    });
                    form.setValue("icon", undefined, { shouldDirty: true });
                    form.setValue("iconColor", undefined, {
                      shouldDirty: true,
                    });
                  } else {
                    form.setValue("icon", value.name, { shouldDirty: true });
                    form.setValue("iconColor", value.color, {
                      shouldDirty: true,
                    });
                    form.setValue("emoji", undefined, { shouldDirty: true });
                  }
                }}
              >
                <WorkspaceIcon
                  className="cursor-pointer rounded-full border p-1 transition-colors hover:bg-ui-bg-subtle-hover"
                  emoji={watchedEmoji}
                  icon={watchedIcon}
                  iconColor={watchedIconColor}
                  size="lg"
                />
              </WorkspaceIconSelector>
            ) : (
              <WorkspaceIcon
                className="rounded-md bg-ui-bg-subtle p-1"
                emoji={watchedEmoji}
                icon={watchedIcon}
                iconColor={watchedIconColor}
                size="lg"
              />
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      className="w-full"
                      disabled={!isAdminOrOwner}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              rules={{ required: "Workspace name is required" }}
            />
          </div>
          {isAdminOrOwner && (
            <LoadingButton
              disabled={!form.formState.isDirty}
              loading={isPending}
              size="small"
              type="submit"
              variant={"strand"}
            >
              Save changes
            </LoadingButton>
          )}
        </form>
      </Form>
    </div>
  );
}

function AdvancedTab({
  workspaceId,
  workspaceName,
  isOwner,
}: {
  workspaceId: Id<"workspace">;
  workspaceName: string;
  isOwner: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const navigate = useNavigate();

  const { mutate: deleteWorkspace, isPending } = useMutation({
    mutationFn: useConvexMutation(api.workspace.mutations.deleteWorkspace),
    onSuccess: () => {
      navigate({ to: "/" });
    },
  });

  return (
    <div>
      <div className="mb-6">
        <Heading>Advanced</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Danger zone and advanced workspace settings
        </Text>
      </div>
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <Text className="font-medium">Delete workspace</Text>
            <Text className="text-ui-fg-muted" size="small">
              Permanently delete this workspace and all of its data.
            </Text>
          </div>
          <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
            <LoadingButton
              disabled={!isOwner}
              loading={false}
              onClick={() => setConfirmOpen(true)}
              size="small"
              variant="destructive"
            >
              Delete workspace
            </LoadingButton>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle className="font-medium text-sm">
                  Delete workspace
                </DialogTitle>
              </DialogHeader>
              <div className="px-6 py-4">
                <DialogDescription className="mb-4">
                  This action cannot be undone. All resources, collections, and
                  members will be permanently removed.
                </DialogDescription>
                <div>
                  <Text className="mb-1.5" size="small">
                    Type{" "}
                    <Badge className="mx-0.5" variant="mono">
                      {workspaceName}
                    </Badge>{" "}
                    to confirm
                  </Text>
                  <Input
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={workspaceName}
                    value={confirmText}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose
                  onClick={() => setConfirmText("")}
                  render={<LoadingButton loading={false} variant="secondary" />}
                >
                  Cancel
                </DialogClose>
                <LoadingButton
                  disabled={confirmText !== workspaceName}
                  loading={isPending}
                  onClick={() => deleteWorkspace({ workspaceId })}
                  variant="destructive"
                >
                  Delete workspace
                </LoadingButton>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

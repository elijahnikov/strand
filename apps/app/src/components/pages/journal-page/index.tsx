import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { RiAddLine, RiCalendarLine } from "@remixicon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageContent } from "~/components/common/page-content";
import { ResourceRow } from "~/components/pages/library-page/resource-row";
import { formatDateTitle } from "~/lib/format";
import { closeResourceTabs } from "~/lib/workspace-tabs-store";

export function JournalPageComponent({
  workspaceId,
  selectedDate,
}: {
  workspaceId: Id<"workspace">;
  selectedDate?: string;
}) {
  const { data: entries } = useQuery(
    convexQuery(api.dailyNotes.queries.list, { workspaceId })
  );
  const todayString = useTodayString();
  const navigate = useNavigate();

  const { mutateAsync: getOrCreate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.dailyNotes.mutations.getOrCreate),
  });
  const { mutate: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateTitle),
  });
  const { mutate: togglePin } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.togglePin),
  });
  const { mutate: removeMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.removeMany),
  });
  const { mutate: restoreMany } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.restoreMany),
  });

  const createForDate = async (date: string) => {
    const resourceId = await getOrCreate({ workspaceId, date });
    navigate({
      to: "/workspace/$workspaceId/resource/$resourceId",
      params: { workspaceId, resourceId },
    });
  };

  const handleUpdateTitle = useCallback(
    (resourceId: Id<"resource">, title: string) => {
      updateTitle({ resourceId, title, workspaceId });
    },
    [updateTitle, workspaceId]
  );

  const handleTogglePin = useCallback(
    (resourceId: Id<"resource">) => {
      togglePin({ resourceId, workspaceId });
    },
    [togglePin, workspaceId]
  );

  const handleDelete = useCallback(
    (resourceId: Id<"resource">) => {
      removeMany({ workspaceId, resourceIds: [resourceId] });
      const { nextUrl } = closeResourceTabs(workspaceId, [resourceId]);
      if (nextUrl) {
        navigate({ to: nextUrl });
      }
      toastManager.add({
        type: "success",
        title: "Deleted",
        actionProps: {
          children: "Undo",
          onClick: () => {
            restoreMany({ workspaceId, resourceIds: [resourceId] });
          },
        },
      });
    },
    [removeMany, restoreMany, workspaceId, navigate]
  );

  const todayHasNote = entries?.some((e) => e.dailyNoteDate === todayString);

  const showEmptyDateState =
    selectedDate !== undefined && selectedDate !== todayString;

  return (
    <PageContent className="pt-14 pb-4 md:pt-16" width="xl:w-2/3">
      <div className="flex flex-col gap-y-6">
        {!todayHasNote && (
          <div className="flex justify-end">
            <Button
              disabled={isPending}
              onClick={() => createForDate(todayString)}
              size="small"
              variant="omi"
            >
              <RiAddLine className="size-4" />
              Create today's entry
            </Button>
          </div>
        )}

        {showEmptyDateState && (
          <EmptyDateState
            date={selectedDate}
            disabled={isPending}
            onCreate={() => createForDate(selectedDate)}
          />
        )}

        {entries && entries.length > 0 ? (
          <div className="-mx-3 flex flex-col gap-y-1">
            {entries.map((entry) => (
              <ResourceRow
                isPinned={entry.isPinned}
                key={entry._id}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
                onUpdateTitle={handleUpdateTitle}
                resource={entry}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-ui-border-base border-dashed py-12">
            <RiCalendarLine className="size-6 text-ui-fg-subtle" />
            <Text className="text-ui-fg-subtle" size="small">
              No journal entries yet.
            </Text>
          </div>
        )}
      </div>
    </PageContent>
  );
}

function useTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function EmptyDateState({
  date,
  disabled,
  onCreate,
}: {
  date: string;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-ui-border-base bg-ui-bg-subtle p-4">
      <div className="flex flex-col gap-1">
        <Text className="font-medium" size="small">
          No entry for {formatDateTitle(date)}
        </Text>
        <Text className="text-ui-fg-subtle" size="small">
          Start one for this date or pick another from your calendar.
        </Text>
      </div>
      <Button disabled={disabled} onClick={onCreate} size="small" variant="omi">
        <RiAddLine className="size-4" />
        Create entry for {formatDateTitle(date)}
      </Button>
    </div>
  );
}

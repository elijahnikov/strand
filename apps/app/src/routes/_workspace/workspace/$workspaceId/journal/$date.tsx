import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Skeleton } from "@omi/ui/skeleton";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { RenderResource } from "~/components/pages/resource-page/resource";
import { isValidDateString } from "~/lib/format";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/journal/$date"
)({
  beforeLoad: ({ params }) => {
    if (!isValidDateString(params.date)) {
      throw redirect({
        to: "/workspace/$workspaceId/journal",
        params: { workspaceId: params.workspaceId },
      });
    }
  },
  loader: async ({ context, params }) => {
    const resourceId = await context.queryClient.ensureQueryData(
      convexQuery(api.dailyNotes.queries.getByDate, {
        workspaceId: params.workspaceId as Id<"workspace">,
        date: params.date,
      })
    );
    if (resourceId) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.get, {
          workspaceId: params.workspaceId as Id<"workspace">,
          resourceId,
        })
      );
    }
  },
  component: JournalDateRoute,
});

function JournalDateRoute() {
  const { workspaceId, date } = Route.useParams();
  const wid = workspaceId as Id<"workspace">;

  const { data: resourceId, isLoading } = useQuery(
    convexQuery(api.dailyNotes.queries.getByDate, { workspaceId: wid, date })
  );

  const { mutateAsync: getOrCreate } = useMutation({
    mutationFn: useConvexMutation(api.dailyNotes.mutations.getOrCreate),
  });

  // Auto-create on landing on a date with no entry. Lives in the component
  // (not loader/beforeLoad) to avoid firing on hover-preload.
  const triggeredRef = useRef(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || resourceId || triggeredRef.current) {
      return;
    }
    triggeredRef.current = true;
    getOrCreate({ workspaceId: wid, date }).catch((err) => {
      triggeredRef.current = false;
      const message = err instanceof Error ? err.message : String(err);
      setCreateError(message);
      toastManager.add({
        type: "error",
        title: "Couldn't create journal entry",
        description: message,
      });
    });
  }, [isLoading, resourceId, getOrCreate, wid, date]);

  if (createError && !resourceId) {
    return <JournalDateError date={date} message={createError} />;
  }

  if (!resourceId) {
    return <JournalDateSkeleton />;
  }

  return (
    <Suspense fallback={<JournalDateSkeleton />}>
      <JournalResourceView resourceId={resourceId} workspaceId={wid} />
    </Suspense>
  );
}

function JournalResourceView({
  workspaceId,
  resourceId,
}: {
  workspaceId: Id<"workspace">;
  resourceId: Id<"resource">;
}) {
  const { data: resource } = useSuspenseQuery(
    convexQuery(api.resource.queries.get, { workspaceId, resourceId })
  );
  if (!resource) {
    return null;
  }
  return (
    <div className="mx-auto h-full px-3 pt-8">
      <RenderResource resource={resource} />
    </div>
  );
}

function JournalDateSkeleton() {
  return (
    <div className="mx-auto h-full px-3 pt-8">
      <div className="mx-auto w-full max-w-[1000px] px-4 pt-8 md:w-[75%] md:px-0 md:pt-0 lg:w-[60%] xl:w-[65%]">
        <div className="mt-2 flex flex-col gap-y-1">
          <Skeleton className="h-9 w-2/3" />
          <div className="flex items-center gap-x-2 pt-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="mt-12 flex flex-col gap-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function JournalDateError({
  date,
  message,
}: {
  date: string;
  message: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <Text className="font-medium" size="large">
        Couldn't open journal for {date}
      </Text>
      <Text className="text-ui-fg-subtle" size="small">
        {message}
      </Text>
      <Button
        onClick={() => window.location.reload()}
        size="small"
        variant="outline"
      >
        Retry
      </Button>
    </div>
  );
}

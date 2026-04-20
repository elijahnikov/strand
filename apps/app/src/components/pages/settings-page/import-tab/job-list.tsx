import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { RiDownload2Fill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Doc, Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Text } from "@strand/ui/text";
import { toastManager } from "@strand/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontalIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { INTEGRATION_LOGO } from "./integration-logos";
import { JOB_SOURCE_LOGO_ID, SOURCE_LABELS } from "./source-meta";

type ImportJob = Doc<"importJob">;

const STATUS_VARIANT: Record<
  ImportJob["status"],
  "mono" | "warning" | "success" | "error"
> = {
  uploading: "warning",
  queued: "warning",
  parsing: "warning",
  importing: "warning",
  completed: "success",
  failed: "error",
  cancelled: "mono",
};

function capitalize(s: string) {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

export function JobList({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const { data } = useQuery(
    convexQuery(api.imports.queries.listImports, { workspaceId })
  );

  if (!data || data.length === 0) {
    return (
      <Text className="text-ui-fg-muted" size="small">
        No imports yet.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {data.map((job) => (
        <JobRow job={job} key={job._id} workspaceId={workspaceId} />
      ))}
    </div>
  );
}

function JobRow({
  job,
  workspaceId,
}: {
  job: ImportJob;
  workspaceId: Id<"workspace">;
}) {
  const { mutate: cancel } = useMutation({
    mutationFn: useConvexMutation(api.imports.mutations.cancelImport),
  });
  const { mutate: remove } = useMutation({
    mutationFn: useConvexMutation(api.imports.mutations.deleteImport),
  });
  const { mutate: enrich, isPending: enriching } = useMutation({
    mutationFn: useConvexMutation(api.imports.mutations.enrichImportJob),
    onSuccess: (result) => {
      const scheduled = (result as { scheduled: number }).scheduled;
      toastManager.add({
        type: "success",
        title: "Enrichment queued",
        description: `Scheduled AI enrichment for ${scheduled} resources.`,
      });
    },
  });

  const isActive =
    job.status === "queued" ||
    job.status === "parsing" ||
    job.status === "importing";

  const percent =
    job.counts.total > 0
      ? Math.round(
          ((job.counts.imported + job.counts.skipped + job.counts.failed) /
            job.counts.total) *
            100
        )
      : 0;

  const logoId = JOB_SOURCE_LOGO_ID[job.source];
  const Logo = logoId ? INTEGRATION_LOGO[logoId] : undefined;

  return (
    <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ui-bg-component-hover dark:hover:bg-ui-bg-component">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle">
        {Logo ? (
          <Logo aria-hidden="true" className="h-5 w-5 shrink-0" />
        ) : (
          <RiDownload2Fill className="h-4 w-4 text-ui-fg-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Text className="truncate font-medium text-md text-ui-fg-base">
            {SOURCE_LABELS[job.source]}
          </Text>
          <Badge
            className="px-1 font-mono"
            size="default"
            variant={STATUS_VARIANT[job.status]}
          >
            {capitalize(job.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Text className="text-ui-fg-muted" size="small">
            {formatDistanceToNow(job.startedAt, { addSuffix: true })}
          </Text>
          {job.errorSummary && (
            <>
              <span className="text-ui-fg-muted text-xs">·</span>
              <Text className="truncate text-ui-fg-error" size="xsmall">
                {job.errorSummary}
              </Text>
            </>
          )}
        </div>
        {isActive && job.counts.total > 0 && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
            <div
              className="h-full bg-ui-bg-interactive transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {job.counts.imported > 0 && (
          <Badge className="px-1 font-mono" size="default" variant="success">
            {job.counts.imported} imported
          </Badge>
        )}
        {job.counts.skipped > 0 && (
          <Badge className="px-1 font-mono" size="default" variant="warning">
            {job.counts.skipped} skipped
          </Badge>
        )}
        {job.counts.failed > 0 && (
          <Badge className="px-1 font-mono" size="default" variant="error">
            {job.counts.failed} failed
          </Badge>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ui-fg-muted transition-colors hover:bg-ui-bg-base hover:text-ui-fg-base">
          <MoreHorizontalIcon className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {isActive ? (
            <DropdownMenuItem
              onClick={() => cancel({ workspaceId, jobId: job._id })}
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </DropdownMenuItem>
          ) : (
            <>
              {job.status === "completed" && job.counts.imported > 0 && (
                <>
                  <DropdownMenuItem
                    disabled={enriching}
                    onClick={() => enrich({ workspaceId, jobId: job._id })}
                  >
                    <SparklesIcon className="h-4 w-4" />
                    Enrich all {job.counts.imported} with AI
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-ui-fg-error"
                onClick={() => remove({ workspaceId, jobId: job._id })}
              >
                <TrashIcon className="h-4 w-4 text-ui-fg-error! group-hover/menuitem:text-ui-fg-base!" />
                Remove
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

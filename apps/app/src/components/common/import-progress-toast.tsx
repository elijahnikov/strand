import { convexQuery } from "@convex-dev/react-query";
import { RiDownload2Fill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Doc, Id } from "@strand/backend/_generated/dataModel.js";
import { Text } from "@strand/ui/text";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { INTEGRATION_LOGO } from "~/components/pages/settings-page/import-tab/integration-logos";
import {
  JOB_SOURCE_LOGO_ID,
  SOURCE_LABELS,
} from "~/components/pages/settings-page/import-tab/source-meta";

type ImportJob = Doc<"importJob">;

const ACTIVE_STATUSES: ReadonlySet<ImportJob["status"]> = new Set([
  "queued",
  "parsing",
  "importing",
  "uploading",
]);

const SUCCESS_HOLD_MS = 3500;

function isActiveJob(j: ImportJob): boolean {
  if (!ACTIVE_STATUSES.has(j.status)) {
    return false;
  }
  const processed = j.counts.imported + j.counts.skipped + j.counts.failed;
  if (j.counts.total > 0 && processed >= j.counts.total) {
    return false;
  }
  return true;
}

export function ImportProgressToast({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { data } = useQuery(
    convexQuery(api.imports.queries.listImports, { workspaceId })
  );

  const active = (data ?? []).filter(isActiveJob);

  const prevActiveIdsRef = useRef<Set<Id<"importJob">>>(new Set());
  const [finishing, setFinishing] = useState<
    Array<{ job: ImportJob; expiresAt: number }>
  >([]);

  useEffect(() => {
    const currentActiveIds = new Set(active.map((j) => j._id));
    const prevActiveIds = prevActiveIdsRef.current;
    const justFinished: ImportJob[] = [];

    for (const id of prevActiveIds) {
      if (currentActiveIds.has(id)) {
        continue;
      }
      const job = (data ?? []).find((j) => j._id === id);
      if (job && job.status !== "cancelled") {
        justFinished.push(job);
      }
    }

    prevActiveIdsRef.current = currentActiveIds;

    if (justFinished.length === 0) {
      return;
    }

    const expiresAt = Date.now() + SUCCESS_HOLD_MS;
    setFinishing((prev) => [
      ...prev.filter((e) => !justFinished.some((j) => j._id === e.job._id)),
      ...justFinished.map((job) => ({ job, expiresAt })),
    ]);
  }, [active, data]);

  useEffect(() => {
    if (finishing.length === 0) {
      return;
    }
    const nextExpiry = Math.min(...finishing.map((e) => e.expiresAt));
    const delay = Math.max(0, nextExpiry - Date.now());
    const timeout = setTimeout(() => {
      setFinishing((prev) => prev.filter((e) => e.expiresAt > Date.now()));
    }, delay + 50);
    return () => clearTimeout(timeout);
  }, [finishing]);

  const primaryActive = active[0];
  const primaryFinishing = finishing[0];

  if (primaryActive) {
    return (
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col gap-2">
        <ProgressCard extraCount={active.length - 1} job={primaryActive} />
      </div>
    );
  }

  if (primaryFinishing) {
    return (
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col gap-2">
        <FinishedCard
          extraCount={finishing.length - 1}
          job={primaryFinishing.job}
        />
      </div>
    );
  }

  return null;
}

function ProgressCard({
  job,
  extraCount,
}: {
  job: ImportJob;
  extraCount: number;
}) {
  const logoId = JOB_SOURCE_LOGO_ID[job.source];
  const Logo = logoId ? INTEGRATION_LOGO[logoId] : undefined;

  const processed =
    job.counts.imported + job.counts.skipped + job.counts.failed;
  const hasTotal = job.counts.total > 0;
  const percent = hasTotal
    ? Math.min(100, Math.round((processed / job.counts.total) * 100))
    : 0;

  return (
    <div className="pointer-events-auto flex w-[320px] flex-col gap-2.5 rounded-xl border-[0.5px] bg-ui-bg-component px-3.5 py-3 shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle">
          {Logo ? (
            <Logo aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : (
            <RiDownload2Fill className="h-3.5 w-3.5 text-ui-fg-muted" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text className="truncate font-medium text-sm text-ui-fg-base">
            Importing {SOURCE_LABELS[job.source]}
            {extraCount > 0 && (
              <span className="ml-1 font-normal text-ui-fg-muted">
                +{extraCount} more
              </span>
            )}
          </Text>
          <div className="flex items-center gap-1.5">
            <DotGridLoader />
            <Text
              className="font-mono text-ui-fg-muted tracking-tight"
              size="xsmall"
            >
              {statusText(job)}
            </Text>
          </div>
        </div>
      </div>
      {hasTotal ? (
        <div className="flex flex-col gap-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
            <div
              className="h-full bg-ui-bg-interactive transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Text className="font-mono text-ui-fg-muted" size="xsmall">
              {processed} of {job.counts.total}
            </Text>
            <Text className="font-mono text-ui-fg-muted" size="xsmall">
              {percent}%
            </Text>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FinishedCard({
  job,
  extraCount,
}: {
  job: ImportJob;
  extraCount: number;
}) {
  const logoId = JOB_SOURCE_LOGO_ID[job.source];
  const Logo = logoId ? INTEGRATION_LOGO[logoId] : undefined;
  const isFailed = job.status === "failed";
  const imported = job.counts.imported;

  const headline = isFailed
    ? `${SOURCE_LABELS[job.source]} import failed`
    : `Imported ${imported} ${imported === 1 ? "resource" : "resources"}`;

  const subline = isFailed
    ? (job.errorSummary ?? "Something went wrong")
    : `From ${SOURCE_LABELS[job.source]}`;

  return (
    <div className="pointer-events-auto flex w-[320px] items-center gap-2.5 rounded-xl border-[0.5px] bg-ui-bg-component px-3.5 py-3 shadow-lg">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle">
        {Logo ? (
          <Logo aria-hidden="true" className="h-4 w-4 shrink-0" />
        ) : (
          <RiDownload2Fill className="h-3.5 w-3.5 text-ui-fg-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text className="truncate font-medium text-sm text-ui-fg-base">
          {headline}
          {extraCount > 0 && (
            <span className="ml-1 font-normal text-ui-fg-muted">
              +{extraCount} more
            </span>
          )}
        </Text>
        <Text className="truncate font-mono text-ui-fg-muted" size="xsmall">
          {subline}
        </Text>
      </div>
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          isFailed
            ? "bg-ui-tag-red-bg text-ui-tag-red-icon"
            : "bg-ui-tag-green-bg text-ui-tag-green-icon"
        }`}
      >
        {isFailed ? (
          <XIcon className="h-3 w-3" />
        ) : (
          <CheckIcon className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}

function statusText(job: ImportJob): string {
  switch (job.status) {
    case "uploading":
      return "Uploading file…";
    case "queued":
      return "Queued";
    case "parsing":
      return "Parsing…";
    case "importing":
      return "Importing resources…";
    default:
      return job.status;
  }
}

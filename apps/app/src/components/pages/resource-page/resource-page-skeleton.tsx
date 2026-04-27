import { Skeleton } from "@omi/ui/skeleton";
import { PageContent } from "~/components/common/page-content";

export function ResourcePageSkeleton() {
  return (
    <PageContent className="mt-8">
      {/* Header: title */}
      <Skeleton className="h-8 w-3/4" />
      {/* Header: badges row */}
      <div className="mt-2 flex items-center gap-x-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-24" />
      </div>
      {/* OG image / content area */}
      <Skeleton className="mt-4 h-[300px] w-full rounded-xl" />
      {/* Tags */}
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
      </div>
      {/* Summary */}
      <div className="mt-12 flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </PageContent>
  );
}

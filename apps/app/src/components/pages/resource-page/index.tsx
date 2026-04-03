import { Suspense } from "react";
import Resource from "~/components/pages/resource-page/resource";
import { ResourcePageSkeleton } from "~/components/pages/resource-page/resource-page-skeleton";

export default function ResourcePageComponent() {
  return (
    <Suspense fallback={<ResourcePageSkeleton />}>
      <div className="mx-auto h-full px-3 pt-2">
        <Resource />
      </div>
    </Suspense>
  );
}

import { Suspense } from "react";
import Resource from "~/components/pages/resource-page/resource";

export default function ResourcePageComponent() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="mx-auto h-full px-3 pt-2">
        <Resource />
      </div>
    </Suspense>
  );
}

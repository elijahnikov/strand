import type { GetResourceData } from "~/lib/convex-types";
import { ResourceHeader } from "../resource-header";

export function FileResource({ resource }: { resource: GetResourceData }) {
  return (
    <div>
      <ResourceHeader resource={resource} />
    </div>
  );
}

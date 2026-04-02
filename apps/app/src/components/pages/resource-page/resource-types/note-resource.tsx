import type { GetResourceData } from "~/lib/convex-types";
import { ResourceHeader } from "../resource-header";

export function NoteResource({ resource }: { resource: GetResourceData }) {
  return (
    <div>
      <ResourceHeader resource={resource} />
    </div>
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { NotFoundState } from "~/components/common/not-found-state";
import { FileResource } from "./resource-types/file-resource";
import { NoteResource } from "./resource-types/note-resource";
import { WebsiteResource } from "./resource-types/website-resource";

export default function Resource() {
  const { workspaceId, resourceId } = useParams({
    from: "/_workspace/workspace/$workspaceId/resource/$resourceId",
  });

  const { data: resource } = useSuspenseQuery(
    convexQuery(api.resource.queries.get, {
      workspaceId: workspaceId as Id<"workspace">,
      resourceId: resourceId as Id<"resource">,
    })
  );

  if (!resource) {
    return <NotFoundState />;
  }

  switch (resource.type) {
    case "website":
      return <WebsiteResource resource={resource} />;
    case "note":
      return <NoteResource resource={resource} />;
    case "file":
      return <FileResource resource={resource} />;
    default:
      return null;
  }
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/workspace/$workspaceId/")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { workspaceId } = Route.useParams();
  const { data } = useSuspenseQuery(
    convexQuery(api.workspace.queries.getById, {
      workspaceId: workspaceId as Id<"workspace">,
    })
  );

  return (
    <div>
      <h1>{data.workspace.name}</h1>
    </div>
  );
}

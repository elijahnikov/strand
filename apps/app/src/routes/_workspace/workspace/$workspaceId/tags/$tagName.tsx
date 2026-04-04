import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { TagPageComponent } from "~/components/pages/tag-page";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/tags/$tagName"
)({
  loader: ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    const tagName = params.tagName;
    context.queryClient.prefetchQuery(
      convexQuery(api.resource.queries.getTag, { workspaceId, tagName })
    );
    context.queryClient.prefetchQuery(
      convexQuery(api.resource.queries.listByTag, { workspaceId, tagName })
    );
  },
  component: TagPageComponent,
});

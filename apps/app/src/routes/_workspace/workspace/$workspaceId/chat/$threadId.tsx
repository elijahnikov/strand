import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/chat/$threadId"
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      convexQuery(api.chat.queries.getThread, {
        workspaceId: params.workspaceId as Id<"workspace">,
        threadId: params.threadId as Id<"chatThread">,
      })
    ),
  component: () => null,
});

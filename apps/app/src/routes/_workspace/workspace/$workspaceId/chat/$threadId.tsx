import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_workspace/workspace/$workspaceId/chat/$threadId"
)({
  component: () => null,
});

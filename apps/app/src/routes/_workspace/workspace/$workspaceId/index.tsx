import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HomePageComponent } from "~/components/pages/home-page";

const RECENT_LIMIT = 8;

export const Route = createFileRoute("/_workspace/workspace/$workspaceId/")({
  loader: async ({ context, params }) => {
    const workspaceId = params.workspaceId as Id<"workspace">;
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.home.queries.getHome, { workspaceId })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.resource.queries.listRecent, {
          workspaceId,
          limit: RECENT_LIMIT,
        })
      ),
    ]);
  },
  component: WorkspaceHomePage,
});

function WorkspaceHomePage() {
  const { workspaceId } = Route.useParams();
  const { data: currentUser } = useQuery(
    convexQuery(api.user.queries.currentUser, {})
  );

  const username = currentUser?.user?.username ?? "there";

  return (
    <HomePageComponent
      username={username}
      workspaceId={workspaceId as Id<"workspace">}
    />
  );
}

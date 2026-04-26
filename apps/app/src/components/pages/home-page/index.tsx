import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageContent } from "~/components/common/page-content";
import { AISection } from "./ai-section";
import { Greeting } from "./greeting";
import { HomeChatBox } from "./home-chat-box";
import { HomeSearchBox } from "./home-search-box";
import { RecentResources } from "./recent-resources";

export function HomePageComponent({
  workspaceId,
  username,
}: {
  workspaceId: Id<"workspace">;
  username: string;
}) {
  const { data } = useSuspenseQuery(
    convexQuery(api.home.queries.getHome, { workspaceId })
  );

  return (
    <PageContent className="pt-20! pb-16 md:pt-16!" width="xl:w-[60%]">
      <Greeting
        username={username}
        workspaceEmoji={data.workspace.emoji}
        workspaceIcon={data.workspace.icon}
        workspaceIconColor={data.workspace.iconColor}
        workspaceName={data.workspace.name}
      />
      <div className="-mt-10" />
      <HomeSearchBox workspaceId={workspaceId} />
      {data.ai ? <HomeChatBox workspaceId={workspaceId} /> : null}
      <RecentResources workspaceId={workspaceId} />
      <AISection ai={data.ai} workspaceId={workspaceId} />
    </PageContent>
  );
}

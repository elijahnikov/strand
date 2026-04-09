import type { Id } from "@strand/backend/_generated/dataModel.js";
import { createFileRoute } from "@tanstack/react-router";
import { ChatPageComponent } from "~/components/pages/chat-page";

export const Route = createFileRoute("/_workspace/workspace/$workspaceId/chat")(
  {
    component: ChatPage,
  }
);

function ChatPage() {
  const { workspaceId } = Route.useParams();
  return <ChatPageComponent workspaceId={workspaceId as Id<"workspace">} />;
}

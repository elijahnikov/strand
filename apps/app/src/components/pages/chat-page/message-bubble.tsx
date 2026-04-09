import { convexQuery } from "@convex-dev/react-query";
import { RiChatSmileAiFill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import { cn } from "@strand/ui";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { UserAvatar } from "~/components/common/user-avatar";
import { ResourceBadge } from "./resource-badge";

const RESOURCE_PATTERN = /\[\[resource:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;

function parseMessageContent(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(RESOURCE_PATTERN)) {
    const [full, resourceId = "", title = "", type = ""] = match;
    const index = match.index;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    parts.push(
      <ResourceBadge
        key={`${resourceId}-${index}`}
        resourceId={resourceId}
        title={title}
        type={type}
      />
    );

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  const { data } = useQuery(convexQuery(api.user.queries.currentUser, {}));
  const user = data?.user;

  const textContent = message.parts
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("");

  const renderedContent = isUser
    ? textContent
    : parseMessageContent(textContent);

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {isUser ? (
        <UserAvatar
          className="relative top-2 size-7 shrink-0 text-[10px]"
          image={user?.image ?? undefined}
          name={user?.username ?? "User"}
          size={28}
        />
      ) : (
        <div className="relative top-4 left-2 flex size-5 shrink-0 items-center justify-center">
          <RiChatSmileAiFill />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-sm",
          isUser
            ? "bg-ui-bg-component-hover dark:bg-ui-bg-component"
            : "bg-transparent"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
          {renderedContent}
        </div>
      </div>
    </div>
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { RiChatSmileAiFill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import { cn } from "@strand/ui";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { UserAvatar } from "~/components/common/user-avatar";
import { ResourceBadge } from "./resource-badge";

const RESOURCE_PATTERN = /\[\[resource:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;

// Convert [[resource:ID|Title|type]] → [Title](resource://ID/type)
// so Streamdown can parse it as a markdown link, then we override the `a`
// component to render a ResourceBadge for these links.
function preprocessResourceLinks(text: string): string {
  return text.replace(RESOURCE_PATTERN, (_full, id, title, type) => {
    // Escape pipes/brackets in title for markdown safety
    const safeTitle = title.replace(/[[\]]/g, "");
    return `[${safeTitle}](resource://${id}/${type})`;
  });
}

const markdownComponents = {
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => {
    if (href?.startsWith("resource://")) {
      const withoutScheme = href.slice("resource://".length);
      const slashIdx = withoutScheme.indexOf("/");
      const resourceId =
        slashIdx >= 0 ? withoutScheme.slice(0, slashIdx) : withoutScheme;
      const type = slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : "";
      const title = typeof children === "string" ? children : String(children);
      return <ResourceBadge resourceId={resourceId} title={title} type={type} />;
    }
    return (
      <a href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  },
};

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
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

  const processedText = isUser
    ? textContent
    : preprocessResourceLinks(textContent);

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
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
          {isUser ? (
            <div className="whitespace-pre-wrap">{processedText}</div>
          ) : (
            <Streamdown
              animated
              components={markdownComponents}
              isAnimating={isStreaming}
            >
              {processedText}
            </Streamdown>
          )}
        </div>
      </div>
    </div>
  );
}

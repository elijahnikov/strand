import { convexQuery } from "@convex-dev/react-query";
import { RiChatSmileAiFill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Streamdown } from "streamdown";
import { UserAvatar } from "~/components/common/user-avatar";
import { ResourceBadge } from "./resource-badge";

const RESOURCE_PATTERN = /\[\[resource:([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]\]/g;

const KNOWN_TYPES = new Set(["website", "note", "file"]);

function parseResourceMatch(
  rawId: string,
  field2: string | undefined,
  field3: string | undefined
): { resourceId: string; title: string; type: string } {
  const resourceId = rawId.trim();
  if (field2 !== undefined && field3 !== undefined) {
    return { resourceId, title: field2.trim(), type: field3.trim() };
  }
  if (field2 !== undefined) {
    const trimmed = field2.trim();
    if (KNOWN_TYPES.has(trimmed)) {
      return { resourceId, title: "", type: trimmed };
    }
    return { resourceId, title: trimmed, type: "" };
  }
  return { resourceId, title: "", type: "" };
}

function parsePlainTextWithResources(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(RESOURCE_PATTERN)) {
    const [full, rawId = "", field2, field3] = match;
    const { resourceId, title, type } = parseResourceMatch(
      rawId,
      field2,
      field3
    );
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

function preprocessResourceLinks(text: string): string {
  return text.replace(RESOURCE_PATTERN, (_full, rawId, field2, field3) => {
    const { resourceId, title, type } = parseResourceMatch(
      rawId,
      field2,
      field3
    );
    const safeTitle = (title || "Resource").replace(/[[\]]/g, "");
    return `[${safeTitle}](#resource:${resourceId}:${type})`;
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
    if (href?.startsWith("#resource:")) {
      const withoutPrefix = href.slice("#resource:".length);
      const colonIdx = withoutPrefix.indexOf(":");
      const resourceId =
        colonIdx >= 0 ? withoutPrefix.slice(0, colonIdx) : withoutPrefix;
      const type = colonIdx >= 0 ? withoutPrefix.slice(colonIdx + 1) : "";
      const title = typeof children === "string" ? children : String(children);
      return (
        <ResourceBadge
          resourceId={resourceId}
          title={title === "Resource" ? "" : title}
          type={type}
        />
      );
    }
    return (
      <a href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be unavailable
    }
  }, [text]);

  return (
    <Button
      className="size-6 text-ui-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
      onClick={handleCopy}
      size="xsmall"
      variant="ghost"
    >
      {copied ? (
        <CheckIcon className="size-3.5 shrink-0" />
      ) : (
        <CopyIcon className="size-3.5 shrink-0" />
      )}
    </Button>
  );
}

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

  const userParts = isUser ? parsePlainTextWithResources(textContent) : null;
  const assistantText = isUser ? "" : preprocessResourceLinks(textContent);

  // Build clean copy text: replace resource markers with just their titles,
  // then collapse the extra whitespace left by markers without titles.
  const copyText = textContent
    .replace(RESOURCE_PATTERN, (_full, _id, field2, field3) => {
      if (field3 !== undefined) {
        return field2 ?? "";
      }
      if (field2 !== undefined && !KNOWN_TYPES.has(field2.trim())) {
        return field2;
      }
      return "";
    })
    // Collapse runs of spaces/tabs (but preserve newlines)
    .replace(/[ \t]+/g, " ")
    // Remove space immediately before punctuation
    .replace(/ ([,.;:!?])/g, "$1")
    // Trim leading/trailing whitespace per line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return (
    <div className={cn("group flex gap-2", isUser && "flex-row-reverse")}>
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
          "flex max-w-[80%] flex-col",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            isUser
              ? "bg-ui-bg-component-hover dark:bg-ui-bg-component"
              : "bg-transparent"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
            {isUser ? (
              <div className="whitespace-pre-wrap">{userParts}</div>
            ) : (
              <Streamdown
                animated
                components={markdownComponents}
                isAnimating={isStreaming}
              >
                {assistantText}
              </Streamdown>
            )}
          </div>
        </div>
        {!isStreaming && textContent.length > 0 && (
          <div className={cn("mt-0.5", isUser ? "mr-1" : "ml-1")}>
            <CopyButton text={copyText} />
          </div>
        )}
      </div>
    </div>
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { RiChatSmileAiFill } from "@remixicon/react";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import { UserAvatar } from "~/components/common/user-avatar";
import { formatRelativeTime } from "~/lib/format";
import {
  type CollectionProposal,
  ProposeCollectionCard,
} from "./propose-collection-card";
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
      <div className="-mt-5">
      <ResourceBadge
        key={`${resourceId}-${index}`}
        resourceId={resourceId}
        title={title}
        type={type}
      />
      </div>
    );

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function preprocessResourceLinks(text: string): string {
  // Clean up patterns where the model put a resource reference on its own
  // line followed by stray punctuation on the next line. E.g.:
  //   "...some text\n\n[[resource:...]]\n."
  // becomes:
  //   "...some text [[resource:...]]."
  let cleaned = text.replace(
    /[ \t]*\n\s*(\[\[resource:[^\]]+\]\])\s*\n+([.,;:!?])/g,
    " $1$2"
  );
  // Also collapse a resource reference that sits alone on its own line
  // (no trailing punctuation) into the preceding paragraph.
  cleaned = cleaned.replace(
    /([^\n])[ \t]*\n+[ \t]*(\[\[resource:[^\]]+\]\])(?=\s*(?:\n|$))/g,
    "$1 $2"
  );

  return cleaned.replace(RESOURCE_PATTERN, (_full, rawId, field2, field3) => {
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

function Timestamp({ date }: { date: Date }) {
  const [, tick] = useState(0);

  // Re-render every 30s so relative time stays fresh
  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-[11px] text-ui-fg-muted tabular-nums">
      {formatRelativeTime(date.getTime())}
    </span>
  );
}

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
      className="size-6 text-ui-fg-muted"
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

type ProposalToolPart = {
  type: "tool-proposeCollection";
  state: "output-available";
  toolCallId: string;
  output: CollectionProposal;
};

function isProposalToolPart(part: unknown): part is ProposalToolPart {
  if (!part || typeof part !== "object") {
    return false;
  }
  const p = part as Record<string, unknown>;
  return (
    p.type === "tool-proposeCollection" &&
    p.state === "output-available" &&
    typeof p.toolCallId === "string" &&
    typeof p.output === "object" &&
    p.output !== null
  );
}

export function MessageBubble({
  message,
  isStreaming,
  workspaceId,
  threadId,
}: {
  message: UIMessage;
  isStreaming?: boolean;
  workspaceId: Id<"workspace">;
  threadId?: Id<"chatThread">;
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

  const proposals: ProposalToolPart[] = isUser
    ? []
    : (message.parts as unknown[]).filter(isProposalToolPart);

  const userParts = isUser ? parsePlainTextWithResources(textContent) : null;
  const assistantText = isUser ? "" : preprocessResourceLinks(textContent);

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
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return (
    <div
      className={cn(
        "group flex min-w-0",
        isUser ? "flex-row-reverse gap-2" : "gap-0 -ml-2"
      )}
    >
      {isUser ? (
        <UserAvatar
          className="relative top-2 size-7 shrink-0 text-[10px]"
          image={user?.image ?? undefined}
          name={user?.username ?? "User"}
          size={28}
        />
      ) : (
        <div className="relative top-0 left-3.5 flex size-10  shrink-0 items-center justify-center">
                 <img
          alt="Strand"
          className="hidden rounded-lg dark:block"
          height={64}
          src="/STRAND_TRANSPARENT_WHITE.png"
          width={64}
        />
        <img
          alt="Strand"
          className="rounded-lg dark:hidden"
          height={64}
          src="/STRAND_TRANSPARENT_BLACK.png"
          width={64}
        />
        </div>
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[80%] flex-col",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full rounded-xl px-3 py-2 text-sm",
            isUser
              ? "bg-ui-bg-component-hover dark:bg-ui-bg-component"
              : "bg-transparent"
          )}
        >
          <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none break-words leading-relaxed">
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
        {proposals.length > 0 && (
          <div className="flex w-full max-w-full flex-col gap-2">
            {proposals.map((p) => (
              <ProposeCollectionCard
                key={p.toolCallId}
                proposal={p.output}
                threadId={threadId}
                toolCallId={p.toolCallId}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
        {!isStreaming && textContent.length > 0 && (
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "mr-1 flex-row-reverse" : "ml-1"
            )}
          >
            <CopyButton text={copyText} />
            <Timestamp
              date={
                (message as { createdAt?: Date }).createdAt ?? new Date()
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

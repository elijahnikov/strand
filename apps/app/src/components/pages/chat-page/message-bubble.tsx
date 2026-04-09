import { RiUser3Fill } from "@remixicon/react";
import { cn } from "@strand/ui";
import type { UIMessage } from "ai";

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("");

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <RiUser3Fill className="size-3.5" />
        ) : (
          <span className="font-medium text-xs">AI</span>
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {textContent}
        </div>
      </div>
    </div>
  );
}

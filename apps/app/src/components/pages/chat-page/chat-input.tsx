import { RiSendPlaneFill, RiStopFill } from "@remixicon/react";
import { cn } from "@strand/ui";
import { Button } from "@strand/ui/button";
import { useCallback, useRef, useState } from "react";

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
}: {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    },
    []
  );

  return (
    <div className="px-4 pt-0 pb-3">
      <div
        className={cn("relative mx-auto max-w-2xl", [
          "txt-compact-small w-full rounded-md bg-ui-bg-field-component text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base shadow-borders-base outline-none transition-fg hover:bg-ui-bg-field-component-hover",
          "focus-visible:shadow-borders-interactive-with-active",
          "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled! disabled:text-ui-fg-disabled disabled:placeholder-ui-fg-disabled",
          "invalid:shadow-borders-error! aria-invalid:shadow-borders-error!",
        ])}
      >
        <textarea
          className="txt-compact-small max-h-[200px] min-h-[80px] w-full resize-none py-2 pr-10 pl-3 outline-none placeholder:text-muted-foreground"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your library..."
          ref={textareaRef}
          rows={1}
          value={value}
        />
        {isStreaming ? (
          <Button
            className="absolute right-2 bottom-1.5 size-7 rounded-full"
            onClick={onStop}
            size="small"
            variant="outline"
          >
            <RiStopFill className="size-4 shrink-0" />
          </Button>
        ) : (
          <Button
            className="absolute right-2 bottom-1.5 size-7 rounded-full"
            disabled={!value.trim()}
            onClick={handleSubmit}
            size="small"
            variant="strand"
          >
            <RiSendPlaneFill className="size-4 shrink-0" />
          </Button>
        )}
      </div>
    </div>
  );
}

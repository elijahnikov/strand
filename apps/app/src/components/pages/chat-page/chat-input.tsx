import { RiSendPlaneFill, RiStopFill } from "@remixicon/react";
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
    <div className="border-t px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <textarea
          className="min-h-[40px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your library..."
          ref={textareaRef}
          rows={1}
          value={value}
        />
        {isStreaming ? (
          <Button onClick={onStop} size="small" variant="outline">
            <RiStopFill className="size-4" />
          </Button>
        ) : (
          <Button
            disabled={!value.trim()}
            onClick={handleSubmit}
            size="small"
            variant="default"
          >
            <RiSendPlaneFill className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

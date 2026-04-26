/** biome-ignore-all lint/performance/useTopLevelRegex: <> */
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { RiCloseLine, RiSendPlaneFill, RiStopFill } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResourceBadge, ResourceIcon } from "./resource-badge";

export interface Mention {
  resourceId: string;
  title: string;
  type: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  initialValue,
  fullWidth = false,
}: {
  onSend: (content: string, mentions: Mention[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  initialValue?: string;
  fullWidth?: boolean;
}) {
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  const [value, setValue] = useState(initialValue ?? "");
  const [mentions, setMentions] = useState<Mention[]>([]);

  const [mentionState, setMentionState] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperRect, setWrapperRect] = useState<DOMRect | null>(null);

  const { data: searchResults } = useQuery(
    convexQuery(
      api.chat.queries.searchResources,
      mentionState && workspaceId
        ? {
            workspaceId: workspaceId as Id<"workspace">,
            query: mentionState.query || " ",
            limit: 5,
          }
        : "skip"
    )
  );

  const results = useMemo(
    () =>
      (searchResults ?? []).filter(
        (r) => !mentions.some((m) => m.resourceId === r._id)
      ),
    [searchResults, mentions]
  );

  useEffect(() => {
    setHighlightIndex(0);
  }, []);

  const closeMentionPicker = useCallback(() => {
    setMentionState(null);
  }, []);

  const insertMention = useCallback(
    (resource: { _id: string; title: string; type: string }) => {
      if (!(mentionState && textareaRef.current)) {
        return;
      }
      const el = textareaRef.current;
      const before = value.slice(0, mentionState.start);
      const afterStart = mentionState.start + 1 + mentionState.query.length;
      const after = value.slice(afterStart);
      const newValue = `${before}${after}`;
      setValue(newValue);
      setMentions((prev) => [
        ...prev,
        {
          resourceId: resource._id,
          title: resource.title,
          type: resource.type,
        },
      ]);
      setMentionState(null);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(mentionState.start, mentionState.start);
      });
    },
    [mentionState, value]
  );

  const removeMention = useCallback((resourceId: string) => {
    setMentions((prev) => prev.filter((m) => m.resourceId !== resourceId));
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && mentions.length === 0) || isStreaming) {
      return;
    }
    const mentionMarkers = mentions
      .map((m) => `[[resource:${m.resourceId}|${m.title}|${m.type}]]`)
      .join(" ");
    const fullMessage = mentionMarkers
      ? `${trimmed}\n\n${mentionMarkers}`.trim()
      : trimmed;
    onSend(fullMessage, mentions);
    setValue("");
    setMentions([]);
    setMentionState(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, mentions, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionState && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightIndex((i) => (i + 1) % results.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightIndex((i) => (i - 1 + results.length) % results.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selected = results[highlightIndex];
          if (selected) {
            insertMention(selected);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMentionPicker();
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      mentionState,
      results,
      highlightIndex,
      insertMention,
      closeMentionPicker,
      handleSubmit,
    ]
  );

  const maxAutoGrow = fullWidth ? 240 : 200;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxAutoGrow)}px`;

      const cursor = el.selectionStart;
      const textUpToCursor = newValue.slice(0, cursor);
      const atIdx = textUpToCursor.lastIndexOf("@");
      if (atIdx === -1) {
        setMentionState(null);
        return;
      }
      const charBefore = atIdx > 0 ? textUpToCursor[atIdx - 1] : " ";
      if (charBefore && !/\s/.test(charBefore)) {
        setMentionState(null);
        return;
      }
      const query = textUpToCursor.slice(atIdx + 1);
      if (/\s/.test(query)) {
        setMentionState(null);
        return;
      }
      setMentionState({ start: atIdx, query });
    },
    [maxAutoGrow]
  );

  const showPicker = mentionState !== null;

  useEffect(() => {
    if (!showPicker) {
      return;
    }
    const update = () => {
      if (wrapperRef.current) {
        setWrapperRect(wrapperRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showPicker]);

  return (
    <div className={cn(fullWidth ? "" : "px-4 pt-0 pb-3")}>
      <div
        className={cn(
          "relative",
          fullWidth ? "mx-auto w-full!" : "mx-auto max-w-2xl",
          [
            "txt-compact-small w-full rounded-md border-[0.5px] bg-ui-bg-field-component-hover text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base outline-none transition-fg hover:bg-ui-bg-component-hover dark:bg-ui-bg-field-component dark:hover:bg-ui-bg-field-component-hover",
            "focus-visible:shadow-borders-interactive-with-active",
            "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled! disabled:text-ui-fg-disabled disabled:placeholder-ui-fg-disabled",
            "invalid:shadow-borders-error! aria-invalid:shadow-borders-error!",
          ]
        )}
        ref={wrapperRef}
      >
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {mentions.map((m) => (
              <div
                className="inline-flex items-center gap-1"
                key={m.resourceId}
              >
                <ResourceBadge
                  resourceId={m.resourceId}
                  title={m.title}
                  type={m.type}
                />
                <Button
                  className="relative -top-[2px] flex size-4 items-center justify-center rounded-full"
                  onClick={() => removeMention(m.resourceId)}
                  size="xsmall"
                  type="button"
                >
                  <RiCloseLine className="size-3 shrink-0" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className={cn(
            "txt-compact-small w-full resize-none py-2 pr-10 pl-3 outline-none placeholder:text-muted-foreground",
            fullWidth
              ? "max-h-[240px] min-h-[110px]"
              : "max-h-[200px] min-h-[80px]"
          )}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your library... (use @ to reference a resource)"
          ref={textareaRef}
          rows={1}
          value={value}
        />
        {showPicker &&
          results.length > 0 &&
          wrapperRect &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[200] rounded-xl border border-[0.5px] bg-ui-bg-component px-1.5 py-1"
              style={{
                left: wrapperRect.left,
                width: wrapperRect.width,
                bottom: window.innerHeight - wrapperRect.top + 8,
              }}
            >
              <div className="max-h-64 overflow-y-auto py-1">
                {results.map((r, i) => (
                  <button
                    className={cn(
                      "txt-compact-small group/menuitem relative flex w-full cursor-pointer select-none items-center gap-x-2 rounded-xl bg-ui-bg-component px-2 py-1.5 text-left font-medium text-ui-fg-subtle outline-none transition-colors [&_svg]:mr-2 [&_svg]:size-4 [&_svg]:text-ui-fg-base",
                      "hover:bg-ui-bg-component-hover hover:text-ui-fg-base focus-visible:bg-ui-bg-component-hover [&_svg]:text-ui-fg-subtle focus:[&_svg]:text-ui-fg-base",
                      "active:bg-ui-bg-component-hover",
                      "data-disabled:pointer-events-none data-disabled:text-ui-fg-disabled data-disabled:[&_svg]:text-ui-fg-disabled",
                      i === highlightIndex && "bg-ui-bg-component-hover"
                    )}
                    key={r._id}
                    onClick={() => insertMention(r)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    type="button"
                  >
                    <ResourceIcon
                      favicon={r.favicon}
                      fileUrl={r.fileUrl}
                      mimeType={r.mimeType}
                      type={r.type}
                    />
                    <Text
                      className="line-clamp-1 flex-1 font-medium"
                      size="small"
                    >
                      {r.title}
                    </Text>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
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
            disabled={!value.trim() && mentions.length === 0}
            onClick={handleSubmit}
            size="small"
            variant="omi"
          >
            <RiSendPlaneFill className="size-4 shrink-0" />
          </Button>
        )}
      </div>
    </div>
  );
}

import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { Text } from "@omi/ui/text";
import {
  RiCloseLine,
  RiDiscussFill,
  RiMoreFill,
  RiSendPlaneFill,
} from "@remixicon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Streamdown } from "streamdown";
import { EmptyState } from "~/components/common/empty-state";
import { UserAvatar } from "~/components/common/user-avatar";
import {
  FLOATING_PANEL_WIDTH,
  useFloatingPanelOffset,
  useFloatingPanelOpen,
  useFloatingPanelsStore,
} from "./floating-panels-store";

interface MemberHit {
  _id: Id<"user">;
  email: string;
  image?: string;
  username: string;
}

const MENTION_TRIGGER = /@([\w.-]*)$/;
const WHITESPACE = /\s/;

export function ResourceCommentsPanel({
  workspaceId,
  resource,
}: {
  workspaceId: Id<"workspace">;
  resource: { _id: Id<"resource">; title: string };
}) {
  const open = useFloatingPanelOpen("comments");
  const closePanel = useFloatingPanelsStore((s) => s.closePanel);
  const setActive = useFloatingPanelsStore((s) => s.setActive);
  const right = useFloatingPanelOffset("comments");

  const { data: comments } = useQuery(
    convexQuery(
      api.resourceComment.queries.list,
      open ? { workspaceId, resourceId: resource._id } : "skip"
    )
  );

  const { mutate: markRead } = useMutation({
    mutationFn: useConvexMutation(api.resourceComment.mutations.markRead),
  });

  const latestAt = comments?.[comments.length - 1]?.createdAt ?? 0;
  useEffect(() => {
    if (!open || latestAt < 0) {
      return;
    }
    markRead({ workspaceId, resourceId: resource._id });
  }, [open, latestAt, workspaceId, resource._id, markRead]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ y: 0, opacity: 1, right }}
          className="fixed bottom-4 z-50 flex h-[600px] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border-[0.5px] bg-ui-bg-subtle shadow-lg"
          exit={{ y: 700, opacity: 0 }}
          initial={{ y: 700, opacity: 0, right }}
          onFocusCapture={() => setActive("comments")}
          onMouseDownCapture={() => setActive("comments")}
          style={{ width: FLOATING_PANEL_WIDTH }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        >
          <div className="flex items-center justify-between border-b-[0.5px] px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <RiDiscussFill className="size-4 shrink-0 text-ui-fg-muted" />
              <Text className="truncate font-medium" size="small">
                Comments — {resource.title}
              </Text>
            </div>
            <Button
              aria-label="Close comments"
              className="size-6"
              onClick={() => closePanel("comments")}
              size="xsmall"
              variant="ghost"
            >
              <RiCloseLine className="size-4 shrink-0" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <CommentList comments={comments ?? []} workspaceId={workspaceId} />
            <CommentComposer
              resourceId={resource._id}
              workspaceId={workspaceId}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type CommentRow = FunctionReturnType<
  typeof api.resourceComment.queries.list
>[number];

function CommentList({
  comments,
  workspaceId,
}: {
  comments: CommentRow[];
  workspaceId: Id<"workspace">;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (comments.length > lastCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    lastCount.current = comments.length;
  }, [comments.length]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 px-4 py-8">
        {comments.length === 0 && (
          <EmptyState
            description="Discuss this resource with your workspace."
            Icon={RiDiscussFill}
            title="Start a conversation"
          />
        )}
        {comments.map((c) => (
          <CommentItem comment={c} key={c._id} workspaceId={workspaceId} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  workspaceId,
}: {
  comment: CommentRow;
  workspaceId: Id<"workspace">;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);

  const { mutate: updateMutate } = useMutation({
    mutationFn: useConvexMutation(api.resourceComment.mutations.update),
  });
  const { mutate: removeMutate } = useMutation({
    mutationFn: useConvexMutation(api.resourceComment.mutations.remove),
  });

  const isOwn = !!comment.author && comment.author._id === comment.authorId;

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      return;
    }
    updateMutate({
      workspaceId,
      commentId: comment._id,
      content: trimmed,
      mentions: comment.mentions,
    });
    setEditing(false);
  };

  const relative = useMemo(
    () => formatDistanceToNow(comment.createdAt, { addSuffix: true }),
    [comment.createdAt]
  );

  return (
    <div className="flex gap-2">
      <UserAvatar
        className="mt-1 size-5 shrink-0"
        image={comment.author?.image}
        name={comment.author?.username ?? ""}
        size={28}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <Text className="font-medium" size="small">
            {comment.author?.username ?? "Unknown"}
          </Text>
          <Text className="mt-px text-ui-fg-muted" size="xsmall">
            {relative}
            {comment.editedAt ? " · edited" : ""}
          </Text>
          <div className="ml-auto">
            {isOwn && !editing && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="Comment actions"
                      className="size-6"
                      size="xsmall"
                      variant="ghost"
                    />
                  }
                >
                  <RiMoreFill className="size-4 shrink-0 text-ui-fg-subtle" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditValue(comment.content);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      removeMutate({ workspaceId, commentId: comment._id })
                    }
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-1">
            <textarea
              className="min-h-[60px] w-full rounded-md border-[0.5px] bg-ui-bg-field-component-hover px-2 py-1.5 text-sm outline-none focus-visible:shadow-borders-interactive-with-active"
              onChange={(e) => setEditValue(e.target.value)}
              value={editValue}
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} size="xsmall" variant="omi">
                Save
              </Button>
              <Button
                onClick={() => setEditing(false)}
                size="xsmall"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none break-words text-sm leading-relaxed">
            <Streamdown>{comment.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentComposer({
  resourceId,
  workspaceId,
}: {
  resourceId: Id<"resource">;
  workspaceId: Id<"workspace">;
}) {
  const [value, setValue] = useState("");
  const [mentions, setMentions] = useState<MemberHit[]>([]);
  const [mentionState, setMentionState] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperRect, setWrapperRect] = useState<DOMRect | null>(null);

  const { mutate: createMutate, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resourceComment.mutations.create),
  });

  const { data: searchResults } = useQuery(
    convexQuery(
      api.workspace.queries.searchMembers,
      mentionState
        ? { workspaceId, query: mentionState.query, limit: 5 }
        : "skip"
    )
  );

  const results = useMemo(
    () =>
      (searchResults ?? []).filter(
        (r) => !mentions.some((m) => m._id === r._id)
      ),
    [searchResults, mentions]
  );

  useEffect(() => {
    setHighlightIndex(0);
  }, []);

  const insertMention = useCallback(
    (member: MemberHit) => {
      if (!(mentionState && textareaRef.current)) {
        return;
      }
      const el = textareaRef.current;
      const before = value.slice(0, mentionState.start);
      const afterStart = mentionState.start + 1 + mentionState.query.length;
      const after = value.slice(afterStart);
      const insertion = `@${member.username} `;
      const newValue = `${before}${insertion}${after}`;
      setValue(newValue);
      setMentions((prev) => [...prev, member]);
      setMentionState(null);
      requestAnimationFrame(() => {
        el.focus();
        const pos = before.length + insertion.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [mentionState, value]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isPending) {
      return;
    }
    const presentMentionIds = mentions
      .filter((m) => value.includes(`@${m.username}`))
      .map((m) => m._id);
    createMutate({
      workspaceId,
      resourceId,
      content: trimmed,
      mentions: presentMentionIds.length > 0 ? presentMentionIds : undefined,
    });
    setValue("");
    setMentions([]);
    setMentionState(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, mentions, isPending, createMutate, workspaceId, resourceId]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
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
          setMentionState(null);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [mentionState, results, highlightIndex, insertMention, handleSubmit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;

      const cursor = el.selectionStart;
      const textUpToCursor = newValue.slice(0, cursor);
      const match = MENTION_TRIGGER.exec(textUpToCursor);
      if (!match) {
        setMentionState(null);
        return;
      }
      const atIdx = textUpToCursor.length - match[0].length;
      const charBefore = atIdx > 0 ? textUpToCursor[atIdx - 1] : " ";
      if (charBefore && !WHITESPACE.test(charBefore)) {
        setMentionState(null);
        return;
      }
      setMentionState({ start: atIdx, query: match[1] ?? "" });
    },
    []
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
    <div className="px-4 pt-0 pb-3">
      <div
        className={cn(
          "relative shadow-xs dark:shadow-sm",
          "mx-auto max-w-2xl",
          "txt-compact-small w-full rounded-md border-[0.5px] bg-ui-bg-field-component-hover text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base outline-none transition-fg hover:bg-ui-bg-component-hover dark:bg-ui-bg-field-component dark:hover:bg-ui-bg-field-component-hover",
          "focus-visible:shadow-borders-interactive-with-active"
        )}
        ref={wrapperRef}
      >
        <textarea
          className="txt-compact-small max-h-[200px] min-h-[80px] w-full resize-none py-2 pr-10 pl-3 outline-none placeholder:text-muted-foreground"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... (use @ to mention a member)"
          ref={textareaRef}
          rows={1}
          value={value}
        />
        <Button
          aria-label="Send comment"
          className="absolute right-2 bottom-1.5 size-7 rounded-full"
          disabled={!value.trim() || isPending}
          onClick={handleSubmit}
          size="small"
          variant="omi"
        >
          <RiSendPlaneFill className="size-4 shrink-0" />
        </Button>
        {showPicker &&
          results.length > 0 &&
          wrapperRect &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[200] rounded-xl border-[0.5px] bg-ui-bg-component px-1.5 py-1"
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
                      "txt-compact-small relative flex w-full cursor-pointer select-none items-center gap-x-2 rounded-xl px-2 py-1.5 text-left font-medium text-ui-fg-subtle outline-none transition-colors",
                      "hover:bg-ui-bg-component-hover hover:text-ui-fg-base",
                      i === highlightIndex && "bg-ui-bg-component-hover"
                    )}
                    key={r._id}
                    onClick={() => insertMention(r)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    type="button"
                  >
                    <UserAvatar
                      className="size-5 shrink-0"
                      image={r.image}
                      name={r.username}
                      size={20}
                    />
                    <Text className="line-clamp-1 flex-1" size="small">
                      {r.username}
                    </Text>
                    <Text className="text-ui-fg-muted" size="xsmall">
                      {r.email}
                    </Text>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

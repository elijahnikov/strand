import type { BlockConfig } from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { createReactBlockSpec } from "@blocknote/react";
import { cn } from "@omi/ui";
import { Button } from "@omi/ui/button";
import { toastManager } from "@omi/ui/toast";
import {
  RiArrowGoBackLine,
  RiCheckLine,
  RiCloseLine,
  RiSparkling2Fill,
} from "@remixicon/react";
import { useState, useSyncExternalStore } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";
import { TextShimmer } from "~/components/common/text-shimmer";

export type Command = "improve" | "continue" | "summarize" | "ask";

const PARAGRAPH_SPLIT = /\n\n+/;

// External store of AI draft state, keyed by block id. We avoid storing the
// streaming/result text in BlockNote props because prop updates don't always
// propagate to the React render through the Tiptap NodeView wrapper.

interface DraftEntry {
  command: Command;
  originalText: string;
  prompt: string;
  state: "awaiting-prompt" | "streaming" | "ready" | "error";
  text: string;
  workspaceId: string;
}

const draftStore = new Map<string, DraftEntry>();
const subscribers = new Map<string, Set<() => void>>();

function subscribe(id: string, listener: () => void) {
  let set = subscribers.get(id);
  if (!set) {
    set = new Set();
    subscribers.set(id, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) {
      subscribers.delete(id);
    }
  };
}

function getEntry(id: string): DraftEntry | undefined {
  return draftStore.get(id);
}

function setEntry(id: string, entry: DraftEntry) {
  draftStore.set(id, entry);
  const set = subscribers.get(id);
  if (set) {
    for (const listener of set) {
      listener();
    }
  }
}

function clearEntry(id: string) {
  draftStore.delete(id);
}

const AI_DRAFT_CONFIG = {
  type: "aiDraft" as const,
  propSchema: {
    draftId: { default: "" as string },
  },
  content: "none" as const,
} satisfies BlockConfig<"aiDraft", { draftId: { default: string } }, "none">;

export const AIDraftSpec = createReactBlockSpec(AI_DRAFT_CONFIG, {
  render: AIDraftBlockRender,
})();

// biome-ignore lint/suspicious/noExplicitAny: BlockNote render props with the full schema are too narrow to type here
function AIDraftBlockRender({ block, editor }: { block: any; editor: any }) {
  const blockId = block.id;
  const draftId = (block.props.draftId as string) || blockId;

  const entry = useSyncExternalStore(
    (cb) => subscribe(draftId, cb),
    () => getEntry(draftId),
    () => undefined
  );

  const state = entry?.state ?? "streaming";
  const text = entry?.text ?? "";
  const command = entry?.command ?? ("improve" as Command);
  const prompt = entry?.prompt ?? "";
  const originalText = entry?.originalText ?? "";
  const workspaceId = entry?.workspaceId ?? "";

  const handleAccept = () => {
    const trimmed = text.trim();
    clearEntry(draftId);
    if (!trimmed) {
      editor.removeBlocks([blockId]);
      return;
    }
    const paragraphs = trimmed.split(PARAGRAPH_SPLIT).map((para: string) => ({
      type: "paragraph" as const,
      content: para.trim() || " ",
    }));
    editor.insertBlocks(paragraphs, blockId, "after");
    editor.removeBlocks([blockId]);
  };

  const handleDiscard = () => {
    clearEntry(draftId);
    editor.removeBlocks([blockId]);
  };

  const handleRetry = () => {
    void runAI(draftId, {
      command,
      prompt,
      originalText,
      workspaceId,
    });
  };

  const handleSubmitPrompt = (newPrompt: string) => {
    void runAI(draftId, {
      command,
      prompt: newPrompt,
      originalText,
      workspaceId,
    });
  };

  return (
    <AIDraftCard
      command={command}
      onAccept={handleAccept}
      onDiscard={handleDiscard}
      onRetry={handleRetry}
      onSubmitPrompt={handleSubmitPrompt}
      state={state}
      text={text}
    />
  );
}

interface AIDraftCardProps {
  command: Command;
  onAccept?: () => void;
  onDiscard?: () => void;
  onRetry?: () => void;
  onSubmitPrompt?: (prompt: string) => void;
  state: "awaiting-prompt" | "streaming" | "ready" | "error";
  text: string;
}

export function AIDraftCard({
  state,
  text,
  command,
  onAccept,
  onDiscard,
  onRetry,
  onSubmitPrompt,
}: AIDraftCardProps) {
  const isAwaitingPrompt = state === "awaiting-prompt";
  const isStreaming = state === "streaming";
  const isError = state === "error";
  const label = labelFor(command, isStreaming, isError);

  if (isAwaitingPrompt) {
    return (
      <AskPromptCard
        onCancel={onDiscard}
        onSubmit={(p) => onSubmitPrompt?.(p)}
      />
    );
  }

  return (
    <div className="my-2 flex flex-col gap-2 rounded-lg border-[0.5px] p-3 shadow-sm">
      <div className="flex items-center gap-2 text-ui-fg-subtle text-xs">
        {isStreaming && <DotGridLoader />}
        {isStreaming ? (
          <TextShimmer className="font-medium text-md">{label}</TextShimmer>
        ) : (
          <span
            className={cn(
              "font-medium text-md",
              isError ? "text-ui-fg-error" : "text-ui-fg-muted"
            )}
          >
            {label}
          </span>
        )}
      </div>
      {text && (
        <div className="whitespace-pre-wrap text-sm text-ui-fg-base">
          {text}
        </div>
      )}
      {!isStreaming && (
        <div className="flex items-center gap-1">
          {state !== "error" && (
            <Button onClick={onAccept} size="small" variant="secondary">
              <RiCheckLine className="size-3.5" />
              Accept
            </Button>
          )}
          <Button onClick={onRetry} size="small" variant="secondary">
            <RiArrowGoBackLine className="size-3.5" />
            Try again
          </Button>
          <Button onClick={onDiscard} size="small" variant="ghost">
            <RiCloseLine className="size-3.5" />
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}

function AskPromptCard({
  onSubmit,
  onCancel,
}: {
  onSubmit: (prompt: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onSubmit(trimmed);
  };
  return (
    <div className="my-2 flex flex-col gap-2 rounded-lg border-[0.5px] p-3 shadow-sm">
      <div className="flex items-center gap-2 text-ui-fg-subtle text-xs">
        <RiSparkling2Fill className="size-3.5 text-blue-500" />
        <span className="font-medium text-md">Ask AI</span>
      </div>
      <textarea
        autoFocus
        className="min-h-[64px] w-full resize-none rounded-md border-[0.5px] bg-ui-bg-field-component px-2 py-1.5 text-sm text-ui-fg-base outline-none placeholder:text-ui-fg-muted focus-visible:shadow-borders-interactive-with-active"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        placeholder="Tell AI what to do…"
        value={value}
      />
      <div className="flex items-center gap-1">
        <Button
          disabled={!value.trim()}
          onClick={submit}
          size="small"
          variant="secondary"
        >
          <RiCheckLine className="size-3.5" />
          Run
        </Button>
        <Button onClick={onCancel} size="small" variant="ghost">
          <RiCloseLine className="size-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function labelFor(
  command: Command,
  isStreaming: boolean,
  isError: boolean
): string {
  if (isError) {
    return "Error";
  }
  switch (command) {
    case "improve":
      return isStreaming ? "Improving writing…" : "Improved writing";
    case "continue":
      return isStreaming ? "Continuing…" : "Continued";
    case "summarize":
      return isStreaming ? "Summarizing…" : "Summary";
    case "ask":
      return isStreaming ? "Working…" : "Result";
    default:
      return "AI";
  }
}

async function runAI(
  draftId: string,
  params: {
    command: Command;
    prompt: string;
    originalText: string;
    workspaceId: string;
  }
) {
  const { workspaceId, command, prompt, originalText } = params;

  if (!workspaceId) {
    toastManager.add({ type: "error", title: "Workspace not available" });
    return;
  }

  setEntry(draftId, {
    state: "streaming",
    text: "",
    command,
    prompt,
    originalText,
    workspaceId,
  });

  try {
    const res = await fetch("/api/inline-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        command,
        prompt: prompt || undefined,
        selection: originalText,
      }),
    });

    if (res.status === 402) {
      toastManager.add({
        type: "error",
        title: "Insufficient credits",
        description: "Top up your workspace to use AI commands.",
      });
      setEntry(draftId, {
        state: "error",
        text: "Insufficient credits.",
        command,
        prompt,
        originalText,
        workspaceId,
      });
      return;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(errText || `AI request failed: ${res.status}`);
    }

    const text = await res.text();
    if (!text) {
      throw new Error("AI returned empty response");
    }

    setEntry(draftId, {
      state: "ready",
      text,
      command,
      prompt,
      originalText,
      workspaceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toastManager.add({
      type: "error",
      title: "AI request failed",
      description: message,
    });
    setEntry(draftId, {
      state: "error",
      text: message,
      command,
      prompt,
      originalText,
      workspaceId,
    });
  }
}

interface RunCommandArgs {
  command: Command;
  // biome-ignore lint/suspicious/noExplicitAny: editor type
  editor: any;
  prompt?: string;
  workspaceId: string;
}

const CONTEXT_BUDGET: Record<Command, number> = {
  improve: 0, // selection-only
  continue: 1500,
  summarize: Number.POSITIVE_INFINITY, // whole doc
  ask: 0, // no implicit context — user can select text to scope it
};

export function runEditorAICommand({
  editor,
  workspaceId,
  command,
  prompt = "",
}: RunCommandArgs): void {
  const selection = (editor.getSelectedText?.() ?? "") as string;
  const cursor = editor.getTextCursorPosition?.();
  const anchorBlock = cursor?.block ?? editor.document.at(-1);

  if (command === "improve" && !selection) {
    toastManager.add({ type: "error", title: "Select text to improve first" });
    return;
  }

  const originalText = selection
    ? selection
    : pickContext(editor, anchorBlock, command);

  if (!originalText.trim() && command !== "ask") {
    toastManager.add({
      type: "error",
      title: "Nothing to work with",
      description: "Add some text to the note first.",
    });
    return;
  }

  const anchorId = anchorBlock?.id ?? editor.document.at(-1)?.id;
  if (!anchorId) {
    toastManager.add({ type: "error", title: "Couldn't place AI block" });
    return;
  }

  const draftId = `aidraft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const needsPrompt = command === "ask" && !prompt;

  // Pre-populate entry so the block render finds state on first paint.
  setEntry(draftId, {
    state: needsPrompt ? "awaiting-prompt" : "streaming",
    text: "",
    command,
    prompt,
    originalText,
    workspaceId,
  });

  const inserted = editor.insertBlocks(
    [{ type: "aiDraft" as const, props: { draftId } }],
    anchorId,
    "after"
  );
  if (!inserted?.[0]?.id) {
    clearEntry(draftId);
    return;
  }

  if (!needsPrompt) {
    void runAI(draftId, {
      command,
      prompt,
      originalText,
      workspaceId,
    });
  }
}

export function getAIItems(
  // biome-ignore lint/suspicious/noExplicitAny: editor type with custom schema is too narrow
  editor: any,
  workspaceId: string
): DefaultReactSuggestionItem[] {
  const startCommand = (command: Command, prompt = "") => {
    runEditorAICommand({ editor, workspaceId, command, prompt });
  };

  return [
    {
      title: "Ask AI",
      group: "AI",
      aliases: ["ai"],
      icon: <RiSparkling2Fill className="size-4 text-blue-500" />,
      onItemClick: () => startCommand("ask"),
    },
    {
      title: "Improve writing",
      group: "AI",
      aliases: ["improve", "rewrite"],
      icon: <RiSparkling2Fill className="size-4 text-blue-500" />,
      onItemClick: () => startCommand("improve"),
    },
    {
      title: "Continue writing",
      group: "AI",
      aliases: ["continue"],
      icon: <RiSparkling2Fill className="size-4 text-blue-500" />,
      onItemClick: () => startCommand("continue"),
    },
    {
      title: "Summarize",
      group: "AI",
      aliases: ["summarize", "summary"],
      icon: <RiSparkling2Fill className="size-4 text-blue-500" />,
      onItemClick: () => startCommand("summarize"),
    },
  ];
}

function pickContext(
  // biome-ignore lint/suspicious/noExplicitAny: editor type
  editor: any,
  anchorBlock: unknown,
  command: Command
): string {
  const budget = CONTEXT_BUDGET[command];
  const blocks = (editor.document as unknown[]) ?? [];
  const anchorId = (anchorBlock as { id?: string } | null)?.id;

  // For "summarize", grab the whole document. For "continue"/"ask", grab text
  // from the start of the doc up through the cursor's block.
  let cutoff = blocks.length;
  if (command !== "summarize" && anchorId) {
    const idx = blocks.findIndex((b) => (b as { id?: string }).id === anchorId);
    if (idx >= 0) {
      cutoff = idx + 1;
    }
  }

  const slice = blocks.slice(0, cutoff);
  const allText = slice
    .map((b) => anchorBlockText(b))
    .filter((t) => t.length > 0)
    .join("\n\n");

  if (allText.length <= budget) {
    return allText;
  }
  return allText.slice(allText.length - budget);
}

function anchorBlockText(block: unknown): string {
  if (!block || typeof block !== "object") {
    return "";
  }
  const b = block as { content?: unknown };
  const c = b.content;
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function hasAIDraftBlocks(blocks: { type: string }[]): boolean {
  return blocks.some((b) => b.type === "aiDraft");
}

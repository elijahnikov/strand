import {
  type Block,
  BlockNoteEditor as BlockNoteEditorClass,
  BlockNoteSchema,
  createCodeBlockSpec,
  createExtension,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  nodeToBlock,
} from "@blocknote/core";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import "./note-editor.css";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { useTheme } from "@omi/ui/theme";
import { toastManager } from "@omi/ui/toast";
import { RiSparkling2Fill } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useConvex, useMutation } from "convex/react";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_FILE_SIZE } from "~/lib/upload-file";
import {
  AIDraftSpec,
  type Command,
  getAIItems,
  hasAIDraftBlocks,
  runEditorAICommand,
} from "./note-editor-ai";
import { strandShadCNComponents } from "./note-editor-components";
import { getMentionItems, Mention } from "./note-editor-mentions";

const supportedLanguages = {
  text: { name: "Plain Text" },
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  python: { name: "Python", aliases: ["py"] },
  html: { name: "HTML" },
  css: { name: "CSS" },
  json: { name: "JSON" },
  markdown: { name: "Markdown", aliases: ["md"] },
  bash: { name: "Bash", aliases: ["sh", "shell"] },
  rust: { name: "Rust", aliases: ["rs"] },
  go: { name: "Go" },
  java: { name: "Java" },
  sql: { name: "SQL" },
  yaml: { name: "YAML", aliases: ["yml"] },
  tsx: { name: "TSX" },
  jsx: { name: "JSX" },
};

const shikiParserSymbol = Symbol.for("blocknote.shikiParser");

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
  blockSpecs: {
    ...defaultBlockSpecs,
    aiDraft: AIDraftSpec,
    codeBlock: createCodeBlockSpec({
      defaultLanguage: "text",
      supportedLanguages,
      createHighlighter: async () => {
        const { createHighlighter: createShiki } = await import("shiki");
        const { createParser } = await import("prosemirror-highlight/shiki");

        const highlighter = await createShiki({
          themes: ["github-light", "github-dark"],
          langs: [],
        });

        const parser = createParser(highlighter, {
          themes: { light: "github-light", dark: "github-dark" },
        });
        (globalThis as Record<symbol, unknown>)[shikiParserSymbol] = parser;

        return highlighter;
      },
    }),
  },
});

const codeBlockTripleBacktick = createExtension({
  key: "codeBlockTripleBacktick",
  inputRules: [
    {
      find: /^```$/,
      replace: () => ({
        type: "codeBlock" as const,
        props: { language: "text" },
        content: [],
      }),
    },
  ],
});

const SAVE_DEBOUNCE_MS = 3000;
const STORAGE_PREFIX = "note-editor-pending:";

const storageKey = (resourceId: string) => `${STORAGE_PREFIX}${resourceId}`;

const readPendingLocal = (resourceId: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(storageKey(resourceId));
  } catch {
    return null;
  }
};

const writePendingLocal = (resourceId: string, json: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(resourceId), json);
  } catch {
    // quota / private mode — ignore
  }
};

const clearPendingLocalIfMatches = (resourceId: string, json: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (window.localStorage.getItem(storageKey(resourceId)) === json) {
      window.localStorage.removeItem(storageKey(resourceId));
    }
  } catch {
    // ignore
  }
};

function parseInitialContent(json: string | undefined): Block[] | undefined {
  if (!json) {
    return;
  }
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed as Block[];
    }
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      const headless = BlockNoteEditorClass.create({
        schema,
        _headless: true,
      });
      const pmNode = headless.pmSchema.nodeFromJSON(parsed);
      const blocks: Block[] = [];
      pmNode.firstChild?.descendants((node) => {
        blocks.push(nodeToBlock(node, headless.pmSchema));
        return false;
      });
      return blocks.length > 0 ? blocks : undefined;
    }
  } catch {
    // fall through
  }
  return;
}

interface NoteEditorProps {
  fallbackHtml?: string;
  fallbackMarkdown?: string;
  initialContent?: string;
  resourceId: Id<"resource">;
  workspaceId: Id<"workspace">;
}

export default function NoteEditor({
  resourceId,
  workspaceId,
  initialContent,
  fallbackMarkdown,
  fallbackHtml,
}: NoteEditorProps) {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const updateContent = useMutation(api.resource.mutations.updateContent);
  const generateUploadUrl = useMutation(
    api.resource.mutations.generateUploadUrl
  );
  const convex = useConvex();

  const handleUpload = useCallback(
    async (file: File): Promise<string> => {
      if (file.size > MAX_FILE_SIZE) {
        toastManager.add({
          type: "error",
          title: "File too large",
          description: `Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
        throw new Error("File too large");
      }
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        toastManager.add({ type: "error", title: "Upload failed" });
        throw new Error("Upload failed");
      }
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      const url = await convex.query(api.resource.queries.getStorageUrl, {
        workspaceId,
        storageId,
      });
      if (!url) {
        toastManager.add({ type: "error", title: "Upload failed" });
        throw new Error("No URL");
      }
      return url;
    },
    [generateUploadUrl, convex, workspaceId]
  );

  const effectiveInitialContent = useMemo(() => {
    const pendingLocal = readPendingLocal(resourceId);
    return pendingLocal ?? initialContent;
  }, [resourceId, initialContent]);

  const savedBlocks = useMemo(
    () => parseInitialContent(effectiveInitialContent),
    [effectiveInitialContent]
  );

  const [fallbackBlocks, fallbackBlocksAreFromImport] = useMemo<
    [Block[] | undefined, boolean]
  >(() => {
    if (savedBlocks && savedBlocks.length > 0) {
      return [undefined, false];
    }
    if (!(fallbackHtml || fallbackMarkdown)) {
      return [undefined, false];
    }
    try {
      const headless = BlockNoteEditorClass.create({
        schema,
        _headless: true,
      });
      const blocks = fallbackHtml
        ? headless.tryParseHTMLToBlocks(fallbackHtml)
        : headless.tryParseMarkdownToBlocks(fallbackMarkdown ?? "");
      return [blocks.length > 0 ? (blocks as Block[]) : undefined, true];
    } catch {
      return [undefined, false];
    }
  }, [savedBlocks, fallbackMarkdown, fallbackHtml]);

  const initialBlocks = savedBlocks ?? fallbackBlocks;

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks,
    extensions: [codeBlockTripleBacktick],
    uploadFile: handleUpload,
    dropCursor: {
      width: 2,
      color: "rgba(115, 115, 115, 0.55)",
    },
  });

  useEffect(() => {
    if (!fallbackBlocksAreFromImport) {
      return;
    }
    const json = JSON.stringify(editor.prosemirrorState.doc.toJSON());
    void updateContent({ workspaceId, resourceId, jsonContent: json });
  }, [
    editor,
    fallbackBlocksAreFromImport,
    resourceId,
    workspaceId,
    updateContent,
  ]);

  // If we recovered unsaved local content on mount, push it to the server
  // so the DB catches up. Clear local only after the server accepts it.
  useEffect(() => {
    const pendingLocal = readPendingLocal(resourceId);
    if (!pendingLocal || pendingLocal === initialContent) {
      return;
    }
    void updateContent({
      resourceId,
      workspaceId,
      jsonContent: pendingLocal,
    }).then(() => {
      clearPendingLocalIfMatches(resourceId, pendingLocal);
    });
  }, [resourceId, workspaceId, initialContent, updateContent]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: string | null = null;

    const flush = () => {
      if (pending === null) {
        return;
      }
      const jsonContent = pending;
      pending = null;
      timer = null;
      void updateContent({ workspaceId, resourceId, jsonContent }).then(() => {
        clearPendingLocalIfMatches(resourceId, jsonContent);
      });
    };

    const unsubscribe = editor.onChange(() => {
      // Skip autosave while an AI draft block is in flight — the user must
      // accept or discard before progress is committed to the DB.
      if (hasAIDraftBlocks(editor.document as { type: string }[])) {
        return;
      }
      const json = JSON.stringify(editor.prosemirrorState.doc.toJSON());
      pending = json;
      writePendingLocal(resourceId, json);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    const onPageHide = () => flush();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (timer) {
        clearTimeout(timer);
      }
      flush();
      unsubscribe();
    };
  }, [editor, updateContent, resourceId, workspaceId]);

  const fixedFloating = {
    useFloatingOptions: { strategy: "fixed" as const },
  };

  return (
    <div className="mt-12 pb-[25vh]">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        shadCNComponents={strandShadCNComponents}
        slashMenu={false}
        theme={resolvedTheme}
      >
        <FormattingToolbarController
          floatingUIOptions={fixedFloating}
          formattingToolbar={() => (
            <FormattingToolbar>
              <AIToolbarMenu workspaceId={workspaceId} />
              {getFormattingToolbarItems()}
            </FormattingToolbar>
          )}
        />
        <SuggestionMenuController
          floatingUIOptions={fixedFloating}
          getItems={(query) => {
            const filter = query.trim().toLowerCase();
            const defaults = getDefaultReactSlashMenuItems(editor as never);
            const filteredDefaults = defaults.filter((item) => {
              const t = item.title.toLowerCase();
              return !(t === "file" || t === "video" || t === "audio");
            });
            const all = [
              ...getAIItems(editor as never, workspaceId),
              ...filteredDefaults,
            ];
            if (!filter) {
              return Promise.resolve(all);
            }
            return Promise.resolve(
              all.filter((item) => {
                const haystack = [
                  item.title,
                  ...(item.aliases ?? []),
                  item.subtext ?? "",
                ]
                  .join(" ")
                  .toLowerCase();
                return haystack.includes(filter);
              })
            );
          }}
          triggerCharacter="/"
        />
        <SuggestionMenuController
          floatingUIOptions={fixedFloating}
          getItems={(query) =>
            getMentionItems({
              editor: editor as never,
              query,
              queryClient,
              workspaceId,
            })
          }
          triggerCharacter="@"
        />
      </BlockNoteView>
    </div>
  );
}

function AIToolbarMenu({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);

  const run = (command: Command, prompt?: string) => {
    setOpen(false);
    runEditorAICommand({
      editor: editor as never,
      workspaceId,
      command,
      prompt,
    });
  };

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <button
            className="bn-button inline-flex h-8 items-center gap-1 self-center rounded-lg px-2 align-middle font-medium text-sm text-ui-fg-base outline-none hover:bg-ui-button-transparent-hover focus-visible:bg-ui-bg-base focus-visible:shadow-buttons-neutral-focus active:bg-ui-button-transparent-pressed"
            type="button"
          >
            <RiSparkling2Fill className="size-3.5 text-blue-500" />
            AI
            <ChevronDownIcon className="size-3 text-ui-fg-muted" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56" sideOffset={6}>
        <DropdownMenuItem onClick={() => run("ask")}>
          <RiSparkling2Fill className="size-4 text-blue-500" />
          Ask AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("improve")}>
          <RiSparkling2Fill className="size-4 text-blue-500" />
          Improve writing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("continue")}>
          <RiSparkling2Fill className="size-4 text-blue-500" />
          Continue writing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("summarize")}>
          <RiSparkling2Fill className="size-4 text-blue-500" />
          Summarize
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

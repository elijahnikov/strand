import {
  type Block,
  type BlockNoteEditor,
  BlockNoteEditor as BlockNoteEditorClass,
  BlockNoteSchema,
  createCodeBlockSpec,
  createExtension,
  defaultBlockSpecs,
  nodeToBlock,
} from "@blocknote/core";
import {
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import "./note-editor.css";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useTheme } from "@strand/ui/theme";
import { useMutation } from "convex/react";
import { useEffect, useMemo } from "react";
import { strandShadCNComponents } from "./note-editor-components";

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
  blockSpecs: {
    ...defaultBlockSpecs,
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
  const updateContent = useMutation(api.resource.mutations.updateContent);

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

  const editor: BlockNoteEditor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks,
    extensions: [codeBlockTripleBacktick],
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
    <div className="mt-12">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        shadCNComponents={strandShadCNComponents}
        slashMenu={false}
        theme={resolvedTheme}
      >
        <FormattingToolbarController floatingUIOptions={fixedFloating} />
        <SuggestionMenuController
          floatingUIOptions={fixedFloating}
          triggerCharacter="/"
        />
      </BlockNoteView>
    </div>
  );
}

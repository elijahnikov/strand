import {
  type BlockNoteEditor,
  BlockNoteSchema,
  createCodeBlockSpec,
  createExtension,
  defaultBlockSpecs,
} from "@blocknote/core";
import {
  FormattingToolbarController,
  SuggestionMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import "./note-editor.css";
import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useTheme } from "@strand/ui/theme";
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

interface NoteEditorProps {
  initialContent?: string;
  resourceId: Id<"resource">;
}

export default function NoteEditor({
  resourceId,
  initialContent,
}: NoteEditorProps) {
  const { resolvedTheme } = useTheme();

  const sync = useBlockNoteSync<BlockNoteEditor>(api.prosemirror, resourceId, {
    snapshotDebounceMs: 1500,
    editorOptions: {
      schema,
      extensions: [codeBlockTripleBacktick],
    },
  });

  if (sync.isLoading) {
    return <div className="mt-12" />;
  }

  if (!sync.editor) {
    const initial = initialContent
      ? JSON.parse(initialContent)
      : { type: "doc", content: [] };
    sync.create(initial);
    return <div className="mt-12" />;
  }

  const fixedFloating = {
    useFloatingOptions: { strategy: "fixed" as const },
  };

  return (
    <div className="mt-12">
      <BlockNoteView
        editor={sync.editor}
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

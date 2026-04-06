import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import {
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useConvexMutation } from "@convex-dev/react-query";
import "@blocknote/shadcn/style.css";
import "./note-editor.css";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useTheme } from "@strand/ui/theme";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef } from "react";
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

interface NoteEditorProps {
  htmlContent?: string;
  jsonContent?: string;
  plainTextContent?: string;
  resourceId: Id<"resource">;
}

function getInitialContent(
  jsonContent?: string,
  htmlContent?: string,
  plainTextContent?: string
) {
  if (jsonContent) {
    try {
      return JSON.parse(jsonContent);
    } catch {
      // fall through
    }
  }
  if (htmlContent || plainTextContent) {
    return undefined;
  }
  return undefined;
}

export default function NoteEditor({
  resourceId,
  jsonContent,
  htmlContent,
  plainTextContent,
}: NoteEditorProps) {
  const { workspaceId } = useParams({
    from: "/_workspace/workspace/$workspaceId/resource/$resourceId",
  });
  const { resolvedTheme } = useTheme();

  const editor = useCreateBlockNote({
    schema,
    initialContent: getInitialContent(jsonContent),
  });

  const { mutate: saveContent } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.updateContent),
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initializedRef = useRef(false);

  if (!initializedRef.current) {
    initializedRef.current = true;
    if (!jsonContent && (htmlContent || plainTextContent)) {
      try {
        const blocks = htmlContent
          ? editor.tryParseHTMLToBlocks(htmlContent)
          : editor.tryParseMarkdownToBlocks(plainTextContent ?? "");
        if (blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch {
        // If parsing fails, start with empty editor
      }
    }
  }

  const handleChange = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const blocks = editor.document;
      const json = JSON.stringify(blocks);
      const html = editor.blocksToHTMLLossy(blocks);

      const textParts: string[] = [];
      for (const block of blocks) {
        if ("content" in block && Array.isArray(block.content)) {
          for (const inline of block.content) {
            if ("text" in inline && typeof inline.text === "string") {
              textParts.push(inline.text);
            }
          }
        }
      }
      const plain = textParts.join("\n");

      saveContent({
        resourceId,
        workspaceId: workspaceId as Id<"workspace">,
        jsonContent: json,
        htmlContent: html,
        plainTextContent: plain,
      });
    }, 800);
  };

  const fixedFloating = {
    useFloatingOptions: { strategy: "fixed" as const },
  };

  return (
    <div className="mt-12">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        onChange={handleChange}
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

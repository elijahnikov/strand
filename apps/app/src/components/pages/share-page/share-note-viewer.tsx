import {
  type Block,
  BlockNoteEditor as BlockNoteEditorClass,
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  nodeToBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import "../resource-page/resource-types/note-editor.css";
import { useTheme } from "@omi/ui/theme";
import { useMemo } from "react";
import { strandShadCNComponents } from "../resource-page/resource-types/note-editor-components";

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

interface ShareNoteViewerProps {
  htmlContent?: string;
  jsonContent?: string;
  plainTextContent?: string;
}

export default function ShareNoteViewer({
  jsonContent,
  htmlContent,
  plainTextContent,
}: ShareNoteViewerProps) {
  const { resolvedTheme } = useTheme();

  const initialBlocks = useMemo<Block[] | undefined>(() => {
    const fromJson = parseInitialContent(jsonContent);
    if (fromJson && fromJson.length > 0) {
      return fromJson;
    }
    if (!(htmlContent || plainTextContent)) {
      return;
    }
    try {
      const headless = BlockNoteEditorClass.create({
        schema,
        _headless: true,
      });
      const blocks = htmlContent
        ? headless.tryParseHTMLToBlocks(htmlContent)
        : headless.tryParseMarkdownToBlocks(plainTextContent ?? "");
      return blocks.length > 0 ? (blocks as Block[]) : undefined;
    } catch {
      return;
    }
  }, [jsonContent, htmlContent, plainTextContent]);

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks,
  });

  return (
    <div className="mt-12">
      <BlockNoteView
        editable={false}
        editor={editor}
        formattingToolbar={false}
        shadCNComponents={strandShadCNComponents}
        slashMenu={false}
        theme={resolvedTheme}
      />
    </div>
  );
}

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ArticleContent {
  content: string;
  excerpt: string;
  length: number;
  textContent: string;
  title: string;
}

export function extractArticleContent(
  html: string,
  url: string
): ArticleContent | null {
  const { document } = parseHTML(html);

  Object.defineProperty(document, "documentURI", { value: url });
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  return {
    title: article.title,
    content: article.content,
    textContent: article.textContent,
    excerpt: article.excerpt,
    length: article.length,
  };
}

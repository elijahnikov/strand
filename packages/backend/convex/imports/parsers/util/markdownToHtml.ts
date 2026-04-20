import { Marked } from "marked";

const marked = new Marked({
  gfm: true,
  breaks: false,
  pedantic: false,
});

export function markdownToHtml(md: string): string {
  if (!md) {
    return "";
  }
  const html = marked.parse(md, { async: false });
  return typeof html === "string" ? html : "";
}

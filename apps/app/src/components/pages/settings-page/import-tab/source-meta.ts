import type { Doc } from "@strand/backend/_generated/dataModel.js";

export type ImportJobSource = Doc<"importJob">["source"];

export const JOB_SOURCE_LOGO_ID: Partial<Record<ImportJobSource, string>> = {
  notion_zip: "notion_zip",
  evernote_enex: "evernote",
  readwise_api: "readwise",
  fabric: "fabric",
  mymind: "mymind",
  notion_oauth: "notion_oauth",
  raindrop_oauth: "raindrop_oauth",
};

export const SOURCE_LABELS: Record<ImportJobSource, string> = {
  markdown_zip: "Markdown",
  notion_zip: "Notion zip",
  evernote_enex: "Evernote",
  readwise_api: "Readwise",
  url_csv: "CSV bookmarks",
  bookmark_html: "Browser bookmarks",
  fabric: "Fabric",
  mymind: "MyMind",
  notion_oauth: "Notion",
  raindrop_oauth: "Raindrop",
};

export type ImportSourceId =
  | "markdown_zip"
  | "url_csv"
  | "bookmark_html"
  | "readwise_api"
  | "evernote_enex"
  | "notion_zip"
  | "fabric"
  | "notion_oauth"
  | "raindrop_oauth";

export type ImportSourceKind = "file" | "connection";

interface BaseImportSource {
  description: string;
  id: string;
  label: string;
  source: ImportSourceId;
}

export interface FileImportSource extends BaseImportSource {
  accept: string;
  instructions: string;
  kind: "file";
}

export interface ConnectionImportSource extends BaseImportSource {
  instructions?: string;
  kind: "connection";
  provider: "readwise" | "notion" | "raindrop";
}

export type UiImportSource = FileImportSource | ConnectionImportSource;

export const UI_IMPORT_SOURCES: UiImportSource[] = [
  {
    kind: "file",
    id: "obsidian",
    label: "Obsidian",
    description: "Import a zipped Obsidian vault. Notes + frontmatter tags.",
    source: "markdown_zip",
    accept: ".zip",
    instructions:
      "Right-click your vault folder and compress it into a .zip, then upload here.",
  },
  {
    kind: "file",
    id: "logseq",
    label: "Logseq",
    description: "Export your Logseq graph as zip and upload here.",
    source: "markdown_zip",
    accept: ".zip",
    instructions:
      "In Logseq, go to Settings → Export graph → Markdown, then zip the folder.",
  },
  {
    kind: "file",
    id: "bear",
    label: "Bear",
    description: "Import a Bear export (.zip of markdown files).",
    source: "markdown_zip",
    accept: ".zip",
    instructions:
      "In Bear, File → Export Notes → Markdown, then zip the folder.",
  },
  {
    kind: "file",
    id: "notion_zip",
    label: "Notion",
    description:
      "Import a Notion export (markdown + CSV). Each page and database row becomes a note.",
    source: "notion_zip",
    accept: ".zip",
    instructions:
      "In Notion, Settings → Export workspace → Markdown & CSV. Upload the resulting .zip here.",
  },
  {
    kind: "file",
    id: "evernote",
    label: "Evernote",
    description:
      "Import an Evernote export (.enex). Notes + tags + timestamps.",
    source: "evernote_enex",
    accept: ".enex,.xml",
    instructions:
      "In Evernote, select a notebook → right-click → Export notes → ENEX.",
  },
  {
    kind: "file",
    id: "fabric",
    label: "Fabric",
    description:
      "Import a Fabric export (.zip). Bookmarks, notes, and attached files.",
    source: "fabric",
    accept: ".zip",
    instructions:
      "In Fabric, export your workspace as a .zip and upload the file here.",
  },
  {
    kind: "connection",
    id: "readwise",
    label: "Readwise",
    description:
      "Import your highlights and notes from Readwise. One note per book or article.",
    source: "readwise_api",
    provider: "readwise",
  },
  {
    kind: "connection",
    id: "notion_oauth",
    label: "Notion",
    description:
      "Import pages from your Notion workspace via OAuth. One note per page.",
    source: "notion_oauth",
    provider: "notion",
    instructions:
      "Notion's API rate limit is 3 requests/second, so large workspaces may take a while.",
  },
  {
    kind: "connection",
    id: "raindrop_oauth",
    label: "Raindrop.io",
    description:
      "Import all bookmarks and collections from your Raindrop account.",
    source: "raindrop_oauth",
    provider: "raindrop",
  },
  {
    kind: "file",
    id: "pocket",
    label: "Pocket",
    description: "Import your saved bookmarks from a Pocket CSV export.",
    source: "url_csv",
    accept: ".csv",
    instructions:
      "Visit getpocket.com/export to download your saves as CSV, then upload here.",
  },
  {
    kind: "file",
    id: "instapaper",
    label: "Instapaper",
    description: "Import your Instapaper saved articles.",
    source: "url_csv",
    accept: ".csv",
    instructions: "Instapaper → Settings → Export → Download CSV.",
  },
  {
    kind: "file",
    id: "raindrop_csv",
    label: "Raindrop.io (CSV)",
    description: "Import Raindrop bookmarks from a CSV export.",
    source: "url_csv",
    accept: ".csv",
    instructions:
      "Raindrop → Settings → Backups → Export CSV (choose a collection).",
  },
  {
    kind: "file",
    id: "mymind",
    label: "MyMind",
    description: "Import your MyMind cards from a CSV export.",
    source: "url_csv",
    accept: ".csv",
    instructions: "MyMind → Settings → Export data → Download CSV.",
  },
  {
    kind: "file",
    id: "chrome",
    label: "Chrome bookmarks",
    description: "Import Chrome bookmarks from a HTML export.",
    source: "bookmark_html",
    accept: ".html,.htm",
    instructions:
      "Chrome → Bookmark Manager → ⋮ → Export bookmarks (saves as HTML).",
  },
  {
    kind: "file",
    id: "safari",
    label: "Safari bookmarks",
    description: "Import Safari bookmarks from a HTML export.",
    source: "bookmark_html",
    accept: ".html,.htm",
    instructions: "Safari → File → Export Bookmarks… (saves as HTML).",
  },
  {
    kind: "file",
    id: "firefox",
    label: "Firefox bookmarks",
    description: "Import Firefox bookmarks from a HTML export.",
    source: "bookmark_html",
    accept: ".html,.htm",
    instructions:
      "Firefox → Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML.",
  },
];

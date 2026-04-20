import type { Doc } from "@strand/backend/_generated/dataModel.js";
import { INTEGRATION_LOGO, type LogoComponent } from "./integration-logos";
import { UI_IMPORT_SOURCES } from "./sources";

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

const UI_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  UI_IMPORT_SOURCES.map((s) => [s.id, s.label])
);

export function resolveJobDisplay(job: {
  source: ImportJobSource;
  uiSourceId?: string;
}): { label: string; Logo: LogoComponent | undefined } {
  const uiId = job.uiSourceId;
  const label =
    (uiId && UI_SOURCE_LABELS[uiId]) ?? SOURCE_LABELS[job.source];
  const logoKey =
    uiId && INTEGRATION_LOGO[uiId] ? uiId : JOB_SOURCE_LOGO_ID[job.source];
  const Logo = logoKey ? INTEGRATION_LOGO[logoKey] : undefined;
  return { label, Logo };
}

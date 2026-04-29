export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function getFileLabel(mimeType?: string): string {
  if (mimeType?.startsWith("image/")) {
    return "IMG";
  }
  if (mimeType?.startsWith("video/")) {
    return "VID";
  }
  if (mimeType?.startsWith("audio/")) {
    return "AUD";
  }
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  return "FILE";
}

export type FilePreviewKind =
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "markdown"
  | "code"
  | "csv"
  | "unsupported";

const CODE_EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  sql: "sql",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  vue: "vue",
  svelte: "svelte",
  lua: "lua",
  r: "r",
  scala: "scala",
  dart: "dart",
  ex: "elixir",
  exs: "elixir",
  clj: "clojure",
  hs: "haskell",
  ml: "ocaml",
  erl: "erlang",
  vim: "vim",
  dockerfile: "dockerfile",
  gql: "graphql",
  graphql: "graphql",
  proto: "protobuf",
  env: "shell",
  gitignore: "shell",
};

function getExtension(fileName?: string): string | undefined {
  if (!fileName) {
    return;
  }
  const dot = fileName.lastIndexOf(".");
  if (dot === -1 || dot === fileName.length - 1) {
    return;
  }
  return fileName.slice(dot + 1).toLowerCase();
}

export function getCodeLanguage(fileName?: string): string | undefined {
  const ext = getExtension(fileName);
  return ext ? CODE_EXTENSIONS[ext] : undefined;
}

function getLocalDateParts(
  timestamp: number,
  timeZone?: string
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    lookup[part.type] = part.value;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function todayLocalDateString(timeZone?: string): string {
  const { year, month, day } = getLocalDateParts(Date.now(), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(date: string): boolean {
  if (!ISO_DATE_PATTERN.test(date)) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === date;
}

export function addDays(date: string, n: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + n);
  return parsed.toISOString().slice(0, 10);
}

export function formatDateTitle(date: string): string {
  // "2026-04-29" -> "April 29, 2026"
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateHeader(date: string): string {
  // "2026-04-29" -> "Wed, April 29 2026"
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function getFilePreviewKind(
  mimeType?: string,
  fileName?: string
): FilePreviewKind {
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType?.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  const ext = getExtension(fileName);

  if (mimeType === "text/markdown" || ext === "md" || ext === "markdown") {
    return "markdown";
  }
  if (mimeType === "text/csv" || ext === "csv" || ext === "tsv") {
    return "csv";
  }
  if (ext && ext in CODE_EXTENSIONS) {
    return "code";
  }

  return "unsupported";
}

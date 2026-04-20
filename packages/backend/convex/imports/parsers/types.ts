export interface ImportAttachment {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

export interface ImportRecord {
  attachment?: ImportAttachment;
  collectionPath?: string[];
  createdAt?: number;
  description?: string;
  htmlContent?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  jsonContent?: string;
  plainTextContent?: string;
  sourceItemId: string;
  tagNames?: string[];
  title: string;
  type: "website" | "note" | "file";
  updatedAt?: number;
  url?: string;
}

export interface ImportError {
  __error: string;
  item?: string;
}

export type ImportYield = ImportRecord | ImportError;

export function isImportError(v: ImportYield): v is ImportError {
  return (v as ImportError).__error !== undefined;
}

export interface FileImportParser {
  kind: "file";
  parse(input: { blob: Blob }): AsyncIterable<ImportYield>;
  source: string;
}

export interface TokenImportParser {
  kind: "token";
  parse(input: { token: string }): AsyncIterable<ImportYield>;
  source: string;
}

export type ImportParser = FileImportParser | TokenImportParser;

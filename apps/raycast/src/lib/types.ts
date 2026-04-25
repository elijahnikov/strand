export type ResourceType = "website" | "note" | "file";

export interface ResourceItemBase {
  _id: string;
  description: string | null;
  title: string;
  type: ResourceType;
  updatedAt: number;
}

export interface WebsiteResourceItem extends ResourceItemBase {
  domain: string | null;
  faviconUrl: string | null;
  previewUrl: string | null;
  type: "website";
  url: string | null;
}

export interface FileResourceItem extends ResourceItemBase {
  fileName: string | null;
  mimeType: string | null;
  previewUrl: string | null;
  type: "file";
}

export interface NoteResourceItem extends ResourceItemBase {
  snippet: string | null;
  type: "note";
}

export type ResourceItem =
  | WebsiteResourceItem
  | FileResourceItem
  | NoteResourceItem;

export interface ListResourcesResponse {
  cursor: string | null;
  isDone: boolean;
  items: ResourceItem[];
  workspaceId: string;
}

export interface MeResponse {
  defaultWorkspaceId: string | null;
  userId: string;
  workspaces: Array<{
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    icon: string | null;
    emoji: string | null;
  }>;
}

export interface CaptureResponse {
  resourceId: string;
}

export interface ConnectLaunchContext {
  defaultWorkspaceId: string | null;
  expiresAt: number;
  state?: string;
  token: string;
  userId: string;
}

import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import { rateLimiter } from "../rateLimiter";

const BEARER_PREFIX = "Bearer ";

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ error: err.message }, { status: err.status });
  }
  if (err instanceof ConvexError) {
    const data = err.data as { kind?: string; retryAfter?: number } | string;
    if (
      typeof data === "object" &&
      data !== null &&
      data.kind === "RateLimited"
    ) {
      const retryAfter = data.retryAfter ?? 0;
      return jsonResponse(
        { error: "Rate limit exceeded", retryAfter },
        {
          status: 429,
          headers: { "retry-after": String(Math.ceil(retryAfter / 1000)) },
        }
      );
    }
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return jsonResponse({ error: message }, { status: 500 });
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) {
    throw new HttpError(401, "Missing bearer token");
  }
  return header.slice(BEARER_PREFIX.length).trim();
}

interface ResolvedAuth {
  defaultWorkspaceId?: Id<"workspace">;
  tokenId: Id<"extensionToken">;
  userId: Id<"user">;
}

async function resolveAuth(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request
): Promise<ResolvedAuth> {
  const token = readBearerToken(request);
  const resolved = await ctx.runQuery(
    internal.extensionAuth.internals.resolveByToken,
    { token }
  );
  if (!resolved) {
    throw new HttpError(401, "Invalid or expired token");
  }
  await ctx.runMutation(internal.extensionAuth.internals.touchLastUsed, {
    tokenId: resolved.tokenId,
  });
  return resolved;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

async function resolveWorkspaceId(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  auth: ResolvedAuth,
  requested: string | undefined
): Promise<Id<"workspace">> {
  const targetId = (requested ?? auth.defaultWorkspaceId) as
    | Id<"workspace">
    | undefined;
  if (!targetId) {
    throw new HttpError(400, "workspaceId is required");
  }
  const member = await ctx.runQuery(
    internal.extensionAuth.internals.getMembership,
    { userId: auth.userId, workspaceId: targetId }
  );
  if (!member) {
    throw new HttpError(403, "Not a member of this workspace");
  }
  return targetId;
}

export const meHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
    const workspaces = await ctx.runQuery(
      internal.extensionAuth.internals.listWorkspacesForUser,
      { userId: auth.userId }
    );
    return jsonResponse({
      userId: auth.userId,
      defaultWorkspaceId: auth.defaultWorkspaceId ?? null,
      workspaces,
    });
  } catch (err) {
    return errorResponse(err);
  }
});

export const uploadUrlHandler = httpAction(async (ctx, request) => {
  try {
    await resolveAuth(ctx, request);
    const uploadUrl = await ctx.runMutation(
      internal.resource.internals.generateUploadUrlInternal,
      {}
    );
    return jsonResponse({ uploadUrl });
  } catch (err) {
    return errorResponse(err);
  }
});

interface CaptureWebsiteBody {
  description?: string;
  title?: string;
  url: string;
  workspaceId?: string;
}

export const captureWebsiteHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
    await rateLimiter.limit(ctx, "extensionCapture", {
      key: auth.userId,
      throws: true,
    });
    const body = await readJson<CaptureWebsiteBody>(request);
    if (!body.url) {
      throw new HttpError(400, "url is required");
    }
    const workspaceId = await resolveWorkspaceId(ctx, auth, body.workspaceId);
    const resourceId = await ctx.runMutation(
      internal.resource.internals.createForUser,
      {
        workspaceId,
        userId: auth.userId,
        type: "website",
        title: body.title?.trim() || body.url,
        description: body.description,
        url: body.url,
      }
    );
    return jsonResponse({ resourceId });
  } catch (err) {
    return errorResponse(err);
  }
});

interface CaptureNoteBody {
  htmlContent?: string;
  jsonContent?: string;
  plainTextContent?: string;
  title: string;
  workspaceId?: string;
}

export const captureNoteHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
    await rateLimiter.limit(ctx, "extensionCapture", {
      key: auth.userId,
      throws: true,
    });
    const body = await readJson<CaptureNoteBody>(request);
    if (!body.title?.trim()) {
      throw new HttpError(400, "title is required");
    }
    const workspaceId = await resolveWorkspaceId(ctx, auth, body.workspaceId);
    const resourceId = await ctx.runMutation(
      internal.resource.internals.createForUser,
      {
        workspaceId,
        userId: auth.userId,
        type: "note",
        title: body.title.trim(),
        plainTextContent: body.plainTextContent,
        jsonContent: body.jsonContent,
        htmlContent: body.htmlContent,
      }
    );
    return jsonResponse({ resourceId });
  } catch (err) {
    return errorResponse(err);
  }
});

interface CaptureFileBody {
  duration?: number;
  fileName: string;
  fileSize: number;
  height?: number;
  mimeType: string;
  storageId: string;
  title?: string;
  width?: number;
  workspaceId?: string;
}

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;

function parseListLimit(raw: string | null): number {
  if (!raw) {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

function parseListType(
  raw: string | null
): "website" | "note" | "file" | undefined {
  if (raw === "website" || raw === "note" || raw === "file") {
    return raw;
  }
  return undefined;
}

export const listResourcesHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const cursor = url.searchParams.get("cursor");
    const type = parseListType(url.searchParams.get("type"));
    const limit = parseListLimit(url.searchParams.get("limit"));
    const workspaceId = await resolveWorkspaceId(
      ctx,
      auth,
      url.searchParams.get("workspaceId") ?? undefined
    );

    const result = await ctx.runQuery(internal.resource.internals.listForUser, {
      workspaceId,
      paginationOpts: { numItems: limit, cursor: cursor ?? null },
      search: search?.trim() || undefined,
      type,
    });

    return jsonResponse({
      items: result.items,
      cursor: result.isDone ? null : result.cursor,
      isDone: result.isDone,
      workspaceId,
    });
  } catch (err) {
    return errorResponse(err);
  }
});

export const captureFileHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
    await rateLimiter.limit(ctx, "extensionCapture", {
      key: auth.userId,
      throws: true,
    });
    const body = await readJson<CaptureFileBody>(request);
    if (!(body.storageId && body.fileName && body.mimeType && body.fileSize)) {
      throw new HttpError(
        400,
        "storageId, fileName, mimeType, fileSize are required"
      );
    }
    const workspaceId = await resolveWorkspaceId(ctx, auth, body.workspaceId);
    const resourceId = await ctx.runMutation(
      internal.resource.internals.createForUser,
      {
        workspaceId,
        userId: auth.userId,
        type: "file",
        title: body.title?.trim() || body.fileName,
        storageId: body.storageId as Id<"_storage">,
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        width: body.width,
        height: body.height,
        duration: body.duration,
      }
    );
    return jsonResponse({ resourceId });
  } catch (err) {
    return errorResponse(err);
  }
});

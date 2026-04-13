import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const BEARER_PREFIX = "Bearer ";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
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
  const message = err instanceof Error ? err.message : "Unknown error";
  return jsonResponse({ error: message }, { status: 500 });
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new HttpError(401, "Missing bearer token");
  }
  return header.slice(BEARER_PREFIX.length).trim();
}

interface ResolvedAuth {
  tokenId: Id<"extensionToken">;
  userId: Id<"user">;
  defaultWorkspaceId?: Id<"workspace">;
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
  workspaceId?: string;
  url: string;
  title?: string;
  description?: string;
}

export const captureWebsiteHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
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
  workspaceId?: string;
  title: string;
  plainTextContent?: string;
  jsonContent?: string;
  htmlContent?: string;
}

export const captureNoteHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
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
  workspaceId?: string;
  storageId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  title?: string;
}

export const captureFileHandler = httpAction(async (ctx, request) => {
  try {
    const auth = await resolveAuth(ctx, request);
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

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveActingBillingAccount } from "../billing/resolver";
import { enrichResource } from "../resource/queries";
import { workspaceQuery } from "../utils";

const CONCEPT_CLUSTER_MIN_RESOURCES = 4;
const CONCEPT_CLUSTER_LIMIT = 4;
const RECENT_CONNECTION_DAYS = 14;
const RECENT_CONNECTION_LIMIT = 4;
const FORGOTTEN_GEM_AGE_DAYS = 30;
const FORGOTTEN_GEM_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ResourcePreview {
  domain?: string | null;
  favicon?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  ogImage?: string | null;
  plainTextSnippet?: string | null;
  summary?: string | null;
}

interface ResourceCard {
  _id: Id<"resource">;
  preview: ResourcePreview;
  title: string;
  type: "website" | "note" | "file";
  updatedAt: number;
}

async function buildResourceCard(
  ctx: QueryCtx,
  resource: Doc<"resource">
): Promise<ResourceCard> {
  const preview: ResourcePreview = {};

  switch (resource.type) {
    case "website": {
      const website = await ctx.db
        .query("websiteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (website) {
        preview.ogImage = website.ogImage;
        preview.favicon = website.favicon;
        preview.domain = website.domain;
      }
      break;
    }
    case "file": {
      const file = await ctx.db
        .query("fileResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (file) {
        preview.mimeType = file.mimeType;
        preview.fileName = file.fileName;
        if (file.mimeType?.startsWith("image/") && file.storageId) {
          preview.fileUrl = await ctx.storage.getUrl(file.storageId);
        }
      }
      break;
    }
    case "note": {
      const note = await ctx.db
        .query("noteResource")
        .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
        .unique();
      if (note?.plainTextContent) {
        preview.plainTextSnippet = note.plainTextContent.slice(0, 140);
      }
      break;
    }
    default:
      break;
  }

  const ai = await ctx.db
    .query("resourceAI")
    .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
    .unique();
  if (ai?.summary) {
    preview.summary = ai.summary;
  }

  return {
    _id: resource._id,
    title: resource.title,
    type: resource.type,
    updatedAt: resource.updatedAt,
    preview,
  };
}

async function getConceptClusters(ctx: QueryCtx, workspaceId: Id<"workspace">) {
  const concepts = await ctx.db
    .query("concept")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const clusters: Array<{
    conceptId: Id<"concept">;
    name: string;
    resourceCount: number;
    sampleResources: Awaited<ReturnType<typeof enrichResource>>[];
  }> = [];

  for (const concept of concepts) {
    const links = await ctx.db
      .query("resourceConcept")
      .withIndex("by_concept", (q) => q.eq("conceptId", concept._id))
      .collect();

    if (links.length < CONCEPT_CLUSTER_MIN_RESOURCES) {
      continue;
    }

    const liveResources: Doc<"resource">[] = [];
    for (const link of links) {
      const resource = await ctx.db.get(link.resourceId);
      if (!resource || resource.deletedAt) {
        continue;
      }
      liveResources.push(resource);
    }

    if (liveResources.length < CONCEPT_CLUSTER_MIN_RESOURCES) {
      continue;
    }

    const sampleResources = await Promise.all(
      liveResources.slice(0, 3).map((r) => enrichResource(ctx, r))
    );

    clusters.push({
      conceptId: concept._id,
      name: concept.name,
      resourceCount: liveResources.length,
      sampleResources,
    });
  }

  clusters.sort((a, b) => b.resourceCount - a.resourceCount);
  return clusters.slice(0, CONCEPT_CLUSTER_LIMIT);
}

async function getRecentConnections(
  ctx: QueryCtx,
  workspaceId: Id<"workspace">
) {
  const cutoff = Date.now() - RECENT_CONNECTION_DAYS * DAY_MS;

  const links = await ctx.db
    .query("resourceLink")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const fresh = links.filter(
    (l) => l.status === "auto" && l.createdAt >= cutoff
  );
  fresh.sort((a, b) => b.score - a.score);

  const results: Array<{
    linkId: Id<"resourceLink">;
    score: number;
    sharedConcepts: string[];
    newer: { _id: Id<"resource">; title: string; type: string };
    older: {
      _id: Id<"resource">;
      title: string;
      type: string;
      updatedAt: number;
    };
  }> = [];

  for (const link of fresh) {
    if (results.length >= RECENT_CONNECTION_LIMIT) {
      break;
    }
    const source = await ctx.db.get(link.sourceResourceId);
    const target = await ctx.db.get(link.targetResourceId);
    if (!(source && target) || source.deletedAt || target.deletedAt) {
      continue;
    }
    const [newer, older] =
      source._creationTime >= target._creationTime
        ? [source, target]
        : [target, source];

    if (newer._creationTime - older._creationTime < 14 * DAY_MS) {
      continue;
    }

    results.push({
      linkId: link._id,
      score: link.score,
      sharedConcepts: link.sharedConcepts.slice(0, 4),
      newer: { _id: newer._id, title: newer.title, type: newer.type },
      older: {
        _id: older._id,
        title: older.title,
        type: older.type,
        updatedAt: older.updatedAt,
      },
    });
  }

  return results;
}

function hashString(s: string): number {
  // Simple non-bitwise rolling hash — only needs to produce a stable ordering.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 2_147_483_647;
  }
  return h;
}

async function getForgottenGems(
  ctx: QueryCtx,
  workspaceId: Id<"workspace">
): Promise<ResourceCard[]> {
  const cutoff = Date.now() - FORGOTTEN_GEM_AGE_DAYS * DAY_MS;

  const completedAI = await ctx.db
    .query("resourceAI")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "completed")
    )
    .collect();

  const candidates: Doc<"resource">[] = [];
  for (const ai of completedAI) {
    if (!ai.summary) {
      continue;
    }
    const resource = await ctx.db.get(ai.resourceId);
    if (!resource || resource.deletedAt) {
      continue;
    }
    if (resource.updatedAt > cutoff) {
      continue;
    }
    candidates.push(resource);
  }

  const dayBucket = Math.floor(Date.now() / DAY_MS);
  candidates.sort((a, b) => {
    const ha = hashString(`${a._id}-${dayBucket}`);
    const hb = hashString(`${b._id}-${dayBucket}`);
    return ha - hb;
  });

  const picked = candidates.slice(0, FORGOTTEN_GEM_LIMIT);
  return Promise.all(picked.map((r) => buildResourceCard(ctx, r)));
}

export const getHome = workspaceQuery({
  args: {},
  handler: async (ctx) => {
    const workspaceId = ctx.workspace._id;

    let plan: "free" | "basic" | "pro" = "free";
    try {
      const resolved = await resolveActingBillingAccount(
        ctx,
        ctx.user._id,
        workspaceId
      );
      plan = resolved.plan;
    } catch {
      // No billing account yet — treat as free
    }

    const isPaid = plan === "basic" || plan === "pro";

    if (!isPaid) {
      return {
        plan,
        workspace: ctx.workspace,
        ai: null,
      };
    }

    const [conceptClusters, recentConnections, forgottenGems] =
      await Promise.all([
        getConceptClusters(ctx, workspaceId),
        getRecentConnections(ctx, workspaceId),
        getForgottenGems(ctx, workspaceId),
      ]);

    return {
      plan,
      workspace: ctx.workspace,
      ai: {
        conceptClusters,
        recentConnections,
        forgottenGems,
      },
    };
  },
});

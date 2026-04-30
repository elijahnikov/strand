import { v } from "convex/values";
import { query } from "../_generated/server";
import { workspaceQuery } from "../utils";

export const getForResource = workspaceQuery({
  args: { resourceId: v.id("resource") },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource || resource.workspaceId !== ctx.workspace._id) {
      return null;
    }
    const share = await ctx.db
      .query("resourceShare")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .unique();
    return share ? { slug: share.slug } : null;
  },
});

export const getPublicBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("resourceShare")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!share) {
      return null;
    }

    const resource = await ctx.db.get(share.resourceId);
    if (!resource || resource.deletedAt) {
      return null;
    }

    const resourceAI = await ctx.db
      .query("resourceAI")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .unique();
    const summary =
      resourceAI?.status === "completed" && resourceAI.summary
        ? resourceAI.summary
        : undefined;

    const content = await ctx.db
      .query("resourceContent")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .unique();

    const author = await ctx.db.get(resource.createdBy);
    const createdBy = {
      username: author?.username ?? "Unknown",
      image: author?.image,
    };

    const resourceTags = await ctx.db
      .query("resourceTag")
      .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
      .collect();
    const tags: { name: string; color?: string }[] = [];
    for (const rt of resourceTags) {
      const tag = await ctx.db.get(rt.tagId);
      if (tag) {
        tags.push({ name: tag.name, color: tag.color });
      }
    }

    let website:
      | {
          url: string;
          favicon?: string;
          ogImage?: string;
          ogTitle?: string;
          ogDescription?: string;
          domain?: string;
          siteName?: string;
          isEmbeddable: boolean;
          embedType?: string;
          embedId?: string;
          metadataStatus: string;
        }
      | undefined;
    let file:
      | {
          fileName: string;
          fileSize: number;
          mimeType: string;
          fileUrl: string | null;
          width?: number;
          height?: number;
          duration?: number;
        }
      | undefined;
    let note:
      | {
          htmlContent?: string;
          jsonContent?: string;
          plainTextContent?: string;
        }
      | undefined;

    switch (resource.type) {
      case "website": {
        const w = await ctx.db
          .query("websiteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        if (w) {
          website = {
            url: w.url,
            favicon: w.favicon,
            ogImage: w.ogImage,
            ogTitle: w.ogTitle,
            ogDescription: w.ogDescription,
            domain: w.domain,
            siteName: w.siteName,
            isEmbeddable: w.isEmbeddable,
            embedType: w.embedType,
            embedId: w.embedId,
            metadataStatus: w.metadataStatus,
          };
        }
        break;
      }
      case "file": {
        const f = await ctx.db
          .query("fileResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        if (f) {
          file = {
            fileName: f.fileName,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            fileUrl: f.storageId ? await ctx.storage.getUrl(f.storageId) : null,
            width: f.width,
            height: f.height,
            duration: f.duration,
          };
        }
        break;
      }
      case "note": {
        const n = await ctx.db
          .query("noteResource")
          .withIndex("by_resource", (q) => q.eq("resourceId", resource._id))
          .unique();
        if (n) {
          note = {
            htmlContent: n.htmlContent,
            jsonContent: n.jsonContent,
            plainTextContent: n.plainTextContent,
          };
        }
        break;
      }
      default:
        break;
    }

    return {
      type: resource.type,
      title: resource.title,
      _creationTime: resource._creationTime,
      website,
      file,
      note,
      summary,
      tags,
      createdBy,
      content: content
        ? {
            htmlContent: content.htmlContent,
            jsonContent: content.jsonContent,
            plainTextContent: content.plainTextContent,
          }
        : null,
    };
  },
});

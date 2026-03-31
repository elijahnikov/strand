"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const EMBED_PATTERNS: Array<{
  type: "youtube" | "tweet" | "reddit" | "spotify" | "github_gist" | "codepen";
  pattern: RegExp;
  extractId: (match: RegExpMatchArray) => string;
}> = [
  {
    type: "youtube",
    pattern:
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "tweet",
    pattern: /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "reddit",
    pattern: /reddit\.com\/r\/\w+\/comments\/(\w+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "spotify",
    pattern: /open\.spotify\.com\/(track|album|playlist)\/(\w+)/,
    extractId: (m) => `${m[1]}/${m[2]}`,
  },
  {
    type: "github_gist",
    pattern: /gist\.github\.com\/\w+\/([a-f0-9]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "codepen",
    pattern: /codepen\.io\/(\w+)\/pen\/(\w+)/,
    extractId: (m) => `${m[1]}/${m[2]}`,
  },
];

function detectEmbed(url: string) {
  for (const { type, pattern, extractId } of EMBED_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { type, id: extractId(match) };
    }
  }
  return null;
}

function extractMetaContent(
  html: string,
  property: string
): string | undefined {
  // Match both property="" and name="" attributes
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1] ?? match?.[2] ?? undefined;
}

const FAVICON_REGEX =
  /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']*)["']/i;

function extractFavicon(html: string, baseUrl: string): string | undefined {
  const match = html.match(FAVICON_REGEX);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    return new URL(match[1], baseUrl).href;
  } catch {
    return undefined;
  }
}

export const extractWebsiteMetadata = internalAction({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    // Set status to processing
    await ctx.runMutation(
      internal.resource.internals.setWebsiteMetadataStatus,
      {
        resourceId: args.resourceId,
        metadataStatus: "processing",
      }
    );

    // Get the website resource to find the URL
    const websiteResource = await ctx.runQuery(
      internal.resource.internals.getWebsiteResource,
      { resourceId: args.resourceId }
    );

    if (!websiteResource) {
      await ctx.runMutation(
        internal.resource.internals.setWebsiteMetadataStatus,
        {
          resourceId: args.resourceId,
          metadataStatus: "failed",
          metadataError: "Website resource not found",
        }
      );
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(websiteResource.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; StrandBot/1.0; +https://strand.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      const ogTitle = extractMetaContent(html, "og:title");
      const ogDescription = extractMetaContent(html, "og:description");
      const ogImage = extractMetaContent(html, "og:image");
      const siteName = extractMetaContent(html, "og:site_name");
      const favicon = extractFavicon(html, websiteResource.url);

      const embed = detectEmbed(websiteResource.url);

      await ctx.runMutation(internal.resource.internals.updateWebsiteMetadata, {
        resourceId: args.resourceId,
        ogTitle,
        ogDescription,
        ogImage,
        siteName,
        favicon,
        isEmbeddable: embed !== null,
        embedType: embed?.type,
        embedId: embed?.id,
        metadataStatus: "completed",
      });
    } catch (error) {
      await ctx.runMutation(
        internal.resource.internals.setWebsiteMetadataStatus,
        {
          resourceId: args.resourceId,
          metadataStatus: "failed",
          metadataError:
            error instanceof Error ? error.message : "Unknown error",
        }
      );
    }
  },
});

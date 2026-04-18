"use node";

import { extractEmbedContent } from "@strand/ai/embed-extraction";
import { extractArticleContent } from "@strand/ai/extraction";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const EMBED_PATTERNS: Array<{
  type:
    | "youtube"
    | "tweet"
    | "reddit"
    | "spotify"
    | "github_gist"
    | "codepen"
    | "vimeo"
    | "loom"
    | "figma"
    | "codesandbox"
    | "bluesky"
    | "soundcloud";
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
  {
    type: "vimeo",
    pattern:
      /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "loom",
    pattern: /loom\.com\/(?:share|embed)\/([a-f0-9]{24,})/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "figma",
    pattern: /figma\.com\/(?:file|design|proto|board)\/([a-zA-Z0-9]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "codesandbox",
    pattern: /codesandbox\.io\/(?:s|embed|p\/sandbox)\/([a-zA-Z0-9-]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "bluesky",
    pattern: /bsky\.app\/profile\/([^/]+)\/post\/([a-zA-Z0-9]+)/,
    extractId: (m) => `${m[1]}/${m[2]}`,
  },
  {
    type: "soundcloud",
    pattern: /soundcloud\.com\/([^/]+)\/(?:sets\/)?([^/?#]+)/,
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

async function resolveValidFavicon(
  html: string,
  baseUrl: string
): Promise<string | undefined> {
  const candidates: string[] = [];

  const declared = extractFavicon(html, baseUrl);
  if (declared) {
    candidates.push(declared);
  }

  try {
    candidates.push(new URL("/favicon.ico", baseUrl).href);
  } catch {
    // invalid baseUrl, skip
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(3000),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.ok && !contentType.includes("text/html")) {
        return url;
      }
    } catch {
      // timeout or network error, try next
    }
  }

  return undefined;
}

export const extractWebsiteMetadata = internalAction({
  args: {
    resourceId: v.id("resource"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(
      internal.resource.internals.setWebsiteMetadataStatus,
      {
        resourceId: args.resourceId,
        metadataStatus: "processing",
      }
    );

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
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      let ogTitle = extractMetaContent(html, "og:title");
      const ogDescription = extractMetaContent(html, "og:description");
      let ogImage = extractMetaContent(html, "og:image");
      const siteName = extractMetaContent(html, "og:site_name");
      const favicon = await resolveValidFavicon(html, websiteResource.url);

      const embed = detectEmbed(websiteResource.url);

      let articleContent: string | undefined;

      if (embed) {
        const embedContent = await extractEmbedContent(
          embed.type,
          embed.id,
          html,
          websiteResource.url
        );
        articleContent = embedContent?.textContent;

        // Embed APIs (Innertube, syndication) return reliable metadata
        // even when the HTML page doesn't (e.g. YouTube bot-detection)
        if (embedContent) {
          ogTitle ??= embedContent.title;
          ogImage ??= embedContent.thumbnailUrl;
        }
      }

      // Only use Readability for non-embed URLs — embed sites
      // (Twitter, YouTube, etc.) return useless HTML to scrapers
      if (!(articleContent || embed)) {
        const article = extractArticleContent(html, websiteResource.url);
        articleContent = article?.textContent;
      }

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
        articleContent,
        metadataStatus: "completed",
      });

      await ctx.scheduler.runAfter(
        0,
        internal.resource.aiActions.processResourceAI,
        { resourceId: args.resourceId }
      );
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

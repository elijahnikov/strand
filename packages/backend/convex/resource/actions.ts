"use node";

import { extractEmbedContent } from "@omi/ai/embed-extraction";
import { extractArticleContent } from "@omi/ai/extraction";
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
    | "soundcloud"
    | "google_docs"
    | "google_sheets"
    | "google_slides"
    | "notion";
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
  {
    type: "google_docs",
    pattern: /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "google_sheets",
    pattern: /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "google_slides",
    pattern: /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    extractId: (m) => m[1] as string,
  },
  {
    type: "notion",
    pattern:
      /(?:(?:[\w-]+\.)?notion\.(?:so|site))\/(?:[^/]+\/)?(?:[^/?#]*-)?([a-f0-9]{32}|[a-zA-Z0-9-]{22,})/,
    extractId: (m) => m[1] as string,
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

const LINK_TAG_REGEX = /<link\b[^>]*>/gi;
const REL_ATTR_REGEX = /\brel\s*=\s*["']([^"']+)["']/i;
const HREF_ATTR_REGEX = /\bhref\s*=\s*["']([^"']+)["']/i;
const WHITESPACE_REGEX = /\s+/;
const ICON_REL_PRIORITY = [
  "icon",
  "shortcut icon",
  "apple-touch-icon",
  "apple-touch-icon-precomposed",
  "mask-icon",
  "fluid-icon",
];

function extractFaviconCandidates(html: string, baseUrl: string): string[] {
  const found: { rel: string; href: string }[] = [];
  const matches = html.matchAll(LINK_TAG_REGEX);
  for (const m of matches) {
    const tag = m[0];
    const relMatch = tag.match(REL_ATTR_REGEX);
    const hrefMatch = tag.match(HREF_ATTR_REGEX);
    if (!(relMatch?.[1] && hrefMatch?.[1])) {
      continue;
    }
    const rels = relMatch[1].toLowerCase().split(WHITESPACE_REGEX);
    const matchedRel = ICON_REL_PRIORITY.find((r) =>
      rels.includes(r.toLowerCase())
    );
    if (!matchedRel) {
      continue;
    }
    found.push({ rel: matchedRel, href: hrefMatch[1] });
  }

  found.sort(
    (a, b) =>
      ICON_REL_PRIORITY.indexOf(a.rel) - ICON_REL_PRIORITY.indexOf(b.rel)
  );

  const urls: string[] = [];
  for (const { href } of found) {
    try {
      urls.push(new URL(href, baseUrl).href);
    } catch {
      // skip invalid hrefs
    }
  }
  return urls;
}

function googleS2Favicon(baseUrl: string): string | undefined {
  try {
    const domain = new URL(baseUrl).hostname;
    if (domain) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    }
  } catch {
    // invalid baseUrl
  }
  return undefined;
}

async function isValidIconUrl(url: string): Promise<boolean> {
  try {
    // Try GET with a tiny range; some servers reject HEAD or block bot UAs.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(3000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
        Range: "bytes=0-0",
      },
    });
    if (!res.ok && res.status !== 206) {
      return false;
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveValidFavicon(
  html: string,
  baseUrl: string
): Promise<string | undefined> {
  const candidates: string[] = [...extractFaviconCandidates(html, baseUrl)];

  try {
    candidates.push(new URL("/favicon.ico", baseUrl).href);
  } catch {
    // invalid baseUrl, skip
  }

  for (const url of candidates) {
    if (await isValidIconUrl(url)) {
      return url;
    }
  }

  // Final fallback: Google's S2 favicon service. Always returns something
  // (a generic globe for unknown domains), so don't validate it — just
  // hand back the URL and let the browser load it.
  return googleS2Favicon(baseUrl);
}

export const extractWebsiteMetadata = internalAction({
  args: {
    resourceId: v.id("resource"),
    skipAI: v.optional(v.boolean()),
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

      if (!args.skipAI) {
        await ctx.scheduler.runAfter(
          0,
          internal.resource.aiActions.processResourceAI,
          { resourceId: args.resourceId }
        );
      }
    } catch (error) {
      // Even when the page fetch fails (Cloudflare block, timeout, 4xx/5xx),
      // we still know the URL — so fall back to Google's S2 favicon service
      // so the row at least has a recognisable icon instead of nothing.
      await ctx.runMutation(internal.resource.internals.updateWebsiteMetadata, {
        resourceId: args.resourceId,
        favicon: googleS2Favicon(websiteResource.url),
        isEmbeddable: false,
        metadataStatus: "failed",
        metadataError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

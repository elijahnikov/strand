import { getTweet } from "react-tweet/api";

export interface EmbedContent {
  author?: string;
  createdAt?: string;
  textContent: string;
  /** Extracted thumbnail URL */
  thumbnailUrl?: string;
  /** Extracted title (may differ from og:title) */
  title?: string;
}

interface ExtractorContext {
  html?: string;
  id: string;
  url?: string;
}

type EmbedType =
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

type EmbedExtractor = (
  ctx: ExtractorContext
) => Promise<EmbedContent | null> | EmbedContent | null;

const extractors: Partial<Record<EmbedType, EmbedExtractor>> = {
  bluesky: extractBlueskyContent,
  figma: extractFigmaContent,
  github_gist: extractGistContent,
  loom: extractLoomContent,
  reddit: extractRedditContent,
  soundcloud: extractSoundcloudContent,
  spotify: extractSpotifyContent,
  tweet: extractTweetContent,
  vimeo: extractVimeoContent,
  youtube: extractYoutubeContent,
};

export async function extractEmbedContent(
  embedType: string,
  embedId: string,
  html?: string,
  url?: string
): Promise<EmbedContent | null> {
  const extractor = extractors[embedType as EmbedType];
  if (!extractor) {
    return null;
  }

  try {
    return await extractor({ id: embedId, html, url });
  } catch {
    return null;
  }
}

async function extractTweetContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  const tweet = await getTweet(ctx.id);
  if (!tweet) {
    return null;
  }

  const parts: string[] = [];

  if (tweet.user?.name) {
    parts.push(`Tweet by ${tweet.user.name} (@${tweet.user.screen_name})`);
  }

  if (tweet.text) {
    parts.push(tweet.text);
  }

  if (tweet.quoted_tweet?.text) {
    parts.push(`Quoted tweet: ${tweet.quoted_tweet.text}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    textContent: parts.join("\n\n"),
    author: tweet.user?.name,
    createdAt: tweet.created_at,
  };
}

interface InnertubeVideoDetails {
  author?: string;
  keywords?: string[];
  shortDescription?: string;
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
  title?: string;
}

interface OembedResponse {
  author_name?: string;
  thumbnail_url?: string;
  title?: string;
}

async function fetchInnertube(videoId: string): Promise<EmbedContent | null> {
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
        context: {
          client: { clientName: "WEB", clientVersion: "2.20240101.00.00" },
        },
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    videoDetails?: InnertubeVideoDetails;
  };
  const vd = data.videoDetails;
  if (!vd?.title) {
    return null;
  }

  const parts: string[] = [];

  if (vd.author) {
    parts.push(`"${vd.title}" by ${vd.author}`);
  } else {
    parts.push(vd.title);
  }

  if (vd.shortDescription) {
    parts.push(vd.shortDescription);
  }

  if (vd.keywords && vd.keywords.length > 0) {
    parts.push(`Keywords: ${vd.keywords.join(", ")}`);
  }

  const thumbnails = vd.thumbnail?.thumbnails;
  const thumbnailUrl = thumbnails?.[thumbnails.length - 1]?.url;

  return {
    textContent: parts.join("\n\n"),
    title: vd.title,
    author: vd.author,
    thumbnailUrl,
  };
}

async function fetchOembed(videoId: string): Promise<EmbedContent | null> {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OembedResponse;
  if (!data.title) {
    return null;
  }

  const parts: string[] = [];

  if (data.author_name) {
    parts.push(`"${data.title}" by ${data.author_name}`);
  } else {
    parts.push(data.title);
  }

  return {
    textContent: parts.join("\n\n"),
    title: data.title,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url
      ? data.thumbnail_url.replace("hqdefault", "maxresdefault")
      : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

async function extractYoutubeContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  // Try Innertube API first (has full description + keywords)
  const innertubeResult = await fetchInnertube(ctx.id);
  if (innertubeResult) {
    return innertubeResult;
  }

  // Fall back to oEmbed API (always works, but no description)
  return fetchOembed(ctx.id);
}

const TRAILING_SLASH_RE = /\/?$/;

interface RedditPostData {
  author?: string;
  selftext?: string;
  subreddit_name_prefixed?: string;
  title?: string;
}

async function extractRedditContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }

  // Reddit's .json endpoint returns post data without auth
  const jsonUrl = ctx.url.replace(TRAILING_SLASH_RE, ".json");
  const response = await fetch(jsonUrl, {
    headers: { "User-Agent": "strand-pkms/1.0" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<{
    data?: { children?: Array<{ data?: RedditPostData }> };
  }>;
  const post = data[0]?.data?.children?.[0]?.data;
  if (!post?.title) {
    return null;
  }

  const parts: string[] = [];

  if (post.subreddit_name_prefixed) {
    parts.push(`${post.subreddit_name_prefixed}: ${post.title}`);
  } else {
    parts.push(post.title);
  }

  if (post.selftext) {
    parts.push(post.selftext);
  }

  return {
    textContent: parts.join("\n\n"),
    title: post.title,
    author: post.author,
  };
}

interface SpotifyOembedResponse {
  thumbnail_url?: string;
  title?: string;
}

async function extractSpotifyContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }

  const response = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(ctx.url)}`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SpotifyOembedResponse;
  if (!data.title) {
    return null;
  }

  return {
    textContent: data.title,
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
  };
}

interface GistFile {
  content?: string;
  filename?: string;
  language?: string;
}

interface GistResponse {
  description?: string;
  files?: Record<string, GistFile>;
  owner?: { login?: string };
}

async function extractGistContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  const response = await fetch(`https://api.github.com/gists/${ctx.id}`, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GistResponse;
  const files = data.files ? Object.values(data.files) : [];

  if (files.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (data.description) {
    parts.push(data.description);
  }

  for (const file of files) {
    if (file.filename && file.content) {
      parts.push(
        `File: ${file.filename}${file.language ? ` (${file.language})` : ""}\n${file.content.slice(0, 2000)}`
      );
    }
  }

  if (parts.length === 0) {
    return null;
  }

  const title =
    data.description || files[0]?.filename || `Gist ${ctx.id.slice(0, 8)}`;

  return {
    textContent: parts.join("\n\n"),
    title,
    author: data.owner?.login,
  };
}

interface VimeoOembedResponse {
  author_name?: string;
  description?: string;
  thumbnail_url?: string;
  title?: string;
  upload_date?: string;
}

async function extractVimeoContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }
  const response = await fetch(
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(ctx.url)}`
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as VimeoOembedResponse;
  if (!data.title) {
    return null;
  }

  const parts: string[] = [];
  if (data.author_name) {
    parts.push(`"${data.title}" by ${data.author_name}`);
  } else {
    parts.push(data.title);
  }
  if (data.description) {
    parts.push(data.description);
  }

  return {
    textContent: parts.join("\n\n"),
    title: data.title,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    createdAt: data.upload_date,
  };
}

interface LoomOembedResponse {
  author_name?: string;
  description?: string;
  thumbnail_url?: string;
  title?: string;
}

async function extractLoomContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }
  const response = await fetch(
    `https://www.loom.com/v1/oembed?url=${encodeURIComponent(ctx.url)}&format=json`
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as LoomOembedResponse;
  if (!data.title) {
    return null;
  }

  const parts: string[] = [];
  if (data.author_name) {
    parts.push(`"${data.title}" by ${data.author_name}`);
  } else {
    parts.push(data.title);
  }
  if (data.description) {
    parts.push(data.description);
  }

  return {
    textContent: parts.join("\n\n"),
    title: data.title,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  };
}

interface FigmaOembedResponse {
  author_name?: string;
  thumbnail_url?: string;
  title?: string;
}

async function extractFigmaContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }
  const response = await fetch(
    `https://www.figma.com/api/oembed?url=${encodeURIComponent(ctx.url)}`
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as FigmaOembedResponse;
  if (!data.title) {
    return null;
  }

  return {
    textContent: data.author_name
      ? `Figma: "${data.title}" by ${data.author_name}`
      : `Figma: ${data.title}`,
    title: data.title,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  };
}

interface SoundcloudOembedResponse {
  author_name?: string;
  description?: string;
  thumbnail_url?: string;
  title?: string;
}

async function extractSoundcloudContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  if (!ctx.url) {
    return null;
  }
  const response = await fetch(
    `https://soundcloud.com/oembed?url=${encodeURIComponent(ctx.url)}&format=json`
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as SoundcloudOembedResponse;
  if (!data.title) {
    return null;
  }

  const parts: string[] = [];
  if (data.author_name) {
    parts.push(`"${data.title}" by ${data.author_name}`);
  } else {
    parts.push(data.title);
  }
  if (data.description) {
    parts.push(data.description);
  }

  return {
    textContent: parts.join("\n\n"),
    title: data.title,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  };
}

interface BlueskyResolveHandleResponse {
  did?: string;
}

interface BlueskyPostThreadResponse {
  thread?: {
    post?: {
      author?: { avatar?: string; displayName?: string; handle?: string };
      record?: { createdAt?: string; text?: string };
    };
  };
}

async function extractBlueskyContent(
  ctx: ExtractorContext
): Promise<EmbedContent | null> {
  const [handle, rkey] = ctx.id.split("/");
  if (!(handle && rkey)) {
    return null;
  }

  const resolveResp = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!resolveResp.ok) {
    return null;
  }
  const { did } = (await resolveResp.json()) as BlueskyResolveHandleResponse;
  if (!did) {
    return null;
  }

  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const threadResp = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
  );
  if (!threadResp.ok) {
    return null;
  }
  const data = (await threadResp.json()) as BlueskyPostThreadResponse;
  const post = data.thread?.post;
  const text = post?.record?.text;
  if (!text) {
    return null;
  }

  const author = post?.author?.displayName ?? post?.author?.handle;
  const parts: string[] = [];
  if (author) {
    parts.push(`Bluesky post by ${author}`);
  }
  parts.push(text);

  return {
    textContent: parts.join("\n\n"),
    title: text.slice(0, 80),
    author,
    thumbnailUrl: post?.author?.avatar,
    createdAt: post?.record?.createdAt,
  };
}

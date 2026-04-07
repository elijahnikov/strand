import { File as PierreFile } from "@pierre/diffs/react";
import { Card } from "@strand/ui/card";
import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { FileCodeIcon, GlobeIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PageContent } from "~/components/common/page-content";

const NoteEditor = lazy(() => import("./note-editor"));

import { Tweet } from "react-tweet";
import type { GetResourceData } from "~/lib/convex-types";
import { RelatedResources } from "../related-resources";
import { ResourceHeader } from "../resource-header";
import { ResourceSummary } from "../resource-summary";
import { ResourceTags } from "../resource-tags";

function OgImage({ alt, src }: { alt: string; src: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return <OgImageEmpty />;
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: image error fallback
    <img
      alt={alt}
      className="mx-auto mt-4 aspect-auto h-[300px] w-full rounded-xl object-cover"
      height="auto"
      onError={() => setError(true)}
      src={src}
      width="auto"
    />
  );
}

function OgImageEmpty() {
  return (
    <div className="mt-4 flex h-[200px] w-full items-center justify-center rounded-xl border border-ui-border-base bg-ui-bg-subtle">
      <div className="flex flex-col items-center gap-2 text-ui-fg-muted">
        <GlobeIcon className="h-8 w-8" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    </div>
  );
}

function LoadingPreview() {
  return (
    <Card className="mt-4 p-2 pb-0">
      <div className="relative h-[300px] w-full overflow-hidden rounded-lg">
        <FlickeringGrid
          className="absolute inset-0 z-0 size-full"
          color="#6B7280"
          flickerChance={0.1}
          gridGap={6}
          height={800}
          maxOpacity={0.5}
          squareSize={4}
          width={800}
        />
      </div>
    </Card>
  );
}

function WebsiteImage({
  website,
  title,
}: {
  website: { metadataStatus?: string; ogImage?: string | null };
  title: string;
}) {
  const isLoading =
    website.metadataStatus === "pending" ||
    website.metadataStatus === "processing";

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          exit={{ opacity: 0 }}
          key="loading"
          transition={{ duration: 0.15 }}
        >
          <LoadingPreview />
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 4 }}
          key="image"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {website.ogImage ? (
            <OgImage alt={title} src={website.ogImage} />
          ) : (
            <OgImageEmpty />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WebsiteEmbed({
  embedType,
  embedId,
  url,
}: {
  embedType: string;
  embedId: string;
  url: string;
}) {
  switch (embedType) {
    case "tweet":
      return (
        <div className="mt-4 [&_.react-tweet-theme]:mx-auto! [&_.react-tweet-theme]:my-0!">
          <Tweet id={embedId} />
        </div>
      );
    case "youtube":
      return (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${embedId}`}
            title="YouTube video"
          />
        </div>
      );
    case "spotify":
      return <SpotifyEmbed embedId={embedId} />;
    case "reddit":
      return <RedditEmbed url={url} />;
    case "github_gist":
      return <GistEmbed id={embedId} />;
    default:
      return null;
  }
}

function SpotifyEmbed({ embedId }: { embedId: string }) {
  const [loaded, setLoaded] = useState(false);
  const height = embedId.startsWith("track") ? 152 : 352;

  return (
    <div className="relative mt-4" style={{ height }}>
      {!loaded && (
        <Card className="absolute inset-0 z-0 p-2 pb-0">
          <div className="relative h-full w-full overflow-hidden rounded-lg">
            <FlickeringGrid
              className="absolute inset-0 z-0 size-full"
              color="#1DB954"
              flickerChance={0.1}
              gridGap={6}
              height={800}
              maxOpacity={0.5}
              squareSize={4}
              width={800}
            />
          </div>
        </Card>
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: iframe load detection */}
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className={`relative z-10 w-full overflow-hidden rounded-xl transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        height={height}
        onLoad={() => setLoaded(true)}
        src={`https://open.spotify.com/embed/${embedId}`}
        title="Spotify embed"
      />
    </div>
  );
}

function RedditEmbed({ url }: { url: string }) {
  const [height, setHeight] = useState(320);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedSrc = `https://www.redditmedia.com${new URL(url).pathname}?ref=share&embed=true`;

  const handleMessage = useCallback((event: MessageEvent) => {
    if (
      typeof event.data === "object" &&
      event.data !== null &&
      "type" in event.data &&
      event.data.type === "resize.embed" &&
      typeof event.data.data === "number" &&
      event.data.data > 0
    ) {
      setHeight(event.data.data);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <div className="relative mt-4 overflow-hidden" style={{ height }}>
      {!loaded && (
        <Card className="absolute inset-0 z-0 p-2 pb-0">
          <div className="relative h-full w-full overflow-hidden rounded-lg">
            <FlickeringGrid
              className="absolute inset-0 z-0 size-full"
              color="#FF4500"
              flickerChance={0.1}
              gridGap={6}
              height={800}
              maxOpacity={0.5}
              squareSize={4}
              width={800}
            />
          </div>
        </Card>
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: iframe load detection */}
      <iframe
        className={`overflow-hidden! relative z-10 w-[99.9%] border-none! transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        height={height}
        onLoad={() => setLoaded(true)}
        ref={iframeRef}
        sandbox="allow-scripts allow-popups-to-escape-sandbox"
        src={embedSrc}
        style={{ border: "none" }}
        title="Reddit post"
      />
    </div>
  );
}

interface GistFileData {
  content: string;
  filename: string;
  language: string | null;
}

const GIST_FILE_OPTIONS = {
  disableFileHeader: true,
  theme: {
    light: "github-light-high-contrast" as const,
    dark: "github-dark-high-contrast" as const,
  },
  unsafeCSS: `
    :host {
      --diffs-font-family: "IoskeleyMono", var(--diffs-font-fallback);
    }
  `,
};

function GistEmbed({ id }: { id: string }) {
  const [files, setFiles] = useState<GistFileData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.github.com/gists/${id}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            files?: Record<
              string,
              {
                content?: string;
                filename?: string;
                language?: string | null;
              }
            >;
          } | null
        ) => {
          if (!data?.files) {
            return;
          }
          const parsed: GistFileData[] = [];
          for (const f of Object.values(data.files)) {
            if (f.filename && f.content) {
              parsed.push({
                filename: f.filename,
                content: f.content,
                language: f.language ?? null,
              });
            }
          }
          setFiles(parsed);
        }
      )
      .catch(() => {
        // Silently handle fetch errors
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Card className="mt-4 p-2 pb-0">
        <div className="relative h-[300px] w-full overflow-hidden rounded-lg">
          <FlickeringGrid
            className="absolute inset-0 z-0 size-full"
            color="#6B7280"
            flickerChance={0.1}
            gridGap={6}
            height={800}
            maxOpacity={0.5}
            squareSize={4}
            width={800}
          />
        </div>
      </Card>
    );
  }

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {files.map((file) => (
        <div
          className="overflow-hidden rounded-xl border border-ui-border-base"
          key={file.filename}
        >
          <div className="flex items-center gap-2 border-ui-border-base border-b bg-ui-bg-subtle px-3 py-2">
            <FileCodeIcon className="h-3.5 w-3.5 text-ui-fg-muted" />
            <span className="font-mono text-ui-fg-subtle text-xs">
              {file.filename}
            </span>
            {file.language && (
              <span className="ml-auto font-mono text-ui-fg-muted text-xs">
                {file.language}
              </span>
            )}
          </div>
          <div className="max-h-[400px] overflow-auto">
            <PierreFile
              file={{ name: file.filename, contents: file.content }}
              options={GIST_FILE_OPTIONS}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WebsiteResource({ resource }: { resource: GetResourceData }) {
  const website = "website" in resource ? resource.website : null;
  if (!website) {
    return null;
  }

  const renderPreview = () => {
    if (
      website.metadataStatus === "pending" ||
      website.metadataStatus === "processing"
    ) {
      return <LoadingPreview />;
    }

    if (website.isEmbeddable && website.embedType && website.embedId) {
      return (
        <WebsiteEmbed
          embedId={website.embedId}
          embedType={website.embedType}
          url={website.url}
        />
      );
    }

    return <WebsiteImage title={resource.title} website={website} />;
  };

  const content = "content" in resource ? resource.content : null;

  return (
    <PageContent className="mt-2">
      <ResourceHeader resource={resource} />
      {renderPreview()}

      <ResourceTags
        aiStatus={resource.resourceAI?.status}
        resourceId={resource._id}
        tags={resource.tags}
      />
      <ResourceSummary resource={resource} />
      {"links" in resource && (
        <RelatedResources
          aiStatus={resource.resourceAI?.status}
          links={resource.links}
        />
      )}
      <Suspense fallback={<div className="mt-6 min-h-[100px]" />}>
        <NoteEditor
          jsonContent={content?.jsonContent ?? undefined}
          key={resource._id}
          resourceId={resource._id}
        />
      </Suspense>
    </PageContent>
  );
}

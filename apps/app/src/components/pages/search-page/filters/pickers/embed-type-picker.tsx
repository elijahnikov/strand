import {
  RiBlueskyFill,
  RiCodeBoxFill,
  RiCodepenFill,
  RiFigmaFill,
  RiFileExcelFill,
  RiFilePptFill,
  RiFileWordFill,
  RiGithubFill,
  RiMovieFill,
  RiNotionFill,
  RiRedditFill,
  RiSoundcloudFill,
  RiSpotifyFill,
  RiTwitterXFill,
  RiVimeoFill,
  RiYoutubeFill,
} from "@remixicon/react";
import {
  EMBED_TYPE_VALUES,
  type SearchEmbedType,
  useSearchFilters,
} from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

const ICON_CLASS = "size-3.5";

const EMBED_ITEMS = [
  {
    id: "youtube",
    label: "YouTube",
    icon: <RiYoutubeFill className={ICON_CLASS} />,
  },
  {
    id: "tweet",
    label: "X / Twitter",
    icon: <RiTwitterXFill className={ICON_CLASS} />,
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: <RiRedditFill className={ICON_CLASS} />,
  },
  {
    id: "spotify",
    label: "Spotify",
    icon: <RiSpotifyFill className={ICON_CLASS} />,
  },
  {
    id: "github_gist",
    label: "GitHub Gist",
    icon: <RiGithubFill className={ICON_CLASS} />,
  },
  {
    id: "codepen",
    label: "CodePen",
    icon: <RiCodepenFill className={ICON_CLASS} />,
  },
  {
    id: "vimeo",
    label: "Vimeo",
    icon: <RiVimeoFill className={ICON_CLASS} />,
  },
  {
    id: "loom",
    label: "Loom",
    icon: <RiMovieFill className={ICON_CLASS} />,
  },
  {
    id: "figma",
    label: "Figma",
    icon: <RiFigmaFill className={ICON_CLASS} />,
  },
  {
    id: "codesandbox",
    label: "CodeSandbox",
    icon: <RiCodeBoxFill className={ICON_CLASS} />,
  },
  {
    id: "bluesky",
    label: "Bluesky",
    icon: <RiBlueskyFill className={ICON_CLASS} />,
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    icon: <RiSoundcloudFill className={ICON_CLASS} />,
  },
  {
    id: "google_docs",
    label: "Google Docs",
    icon: <RiFileWordFill className={ICON_CLASS} />,
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    icon: <RiFileExcelFill className={ICON_CLASS} />,
  },
  {
    id: "google_slides",
    label: "Google Slides",
    icon: <RiFilePptFill className={ICON_CLASS} />,
  },
  {
    id: "notion",
    label: "Notion",
    icon: <RiNotionFill className={ICON_CLASS} />,
  },
];

const EMBED_IDS = new Set<string>(EMBED_TYPE_VALUES);

export const EMBED_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMBED_ITEMS.map((i) => [i.id, i.label])
);

export function EmbedTypePicker() {
  const { embedTypes, setEmbedTypes } = useSearchFilters();
  return (
    <MultiSelectPicker
      emptyMessage="No embeds."
      items={EMBED_ITEMS}
      onChange={(next) => {
        const valid = next.filter((v): v is SearchEmbedType =>
          EMBED_IDS.has(v)
        );
        setEmbedTypes(valid.length === 0 ? null : valid);
      }}
      searchPlaceholder="Search embeds…"
      selectedIds={embedTypes ?? []}
    />
  );
}

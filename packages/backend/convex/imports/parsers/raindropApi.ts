import type { ImportParser, ImportRecord, ImportYield } from "./types";

const RAINDROP_BASE = "https://api.raindrop.io/rest/v1";
const PER_PAGE = 50;
const RATE_LIMIT_MS = 600;
const BACKOFF_MS = 5000;
const MAX_RETRIES = 3;

interface RaindropCollection {
  _id: number;
  parent?: { $id: number };
  title: string;
}

interface CollectionsResponse {
  items: RaindropCollection[];
  result: boolean;
}

interface Raindrop {
  _id: number;
  collection?: { $id: number };
  created?: string;
  excerpt?: string;
  important?: boolean;
  lastUpdate?: string;
  link: string;
  note?: string;
  tags?: string[];
  title?: string;
  type?: string;
}

interface RaindropsResponse {
  count?: number;
  items: Raindrop[];
  result: boolean;
}

export const parseRaindropApi: ImportParser = {
  kind: "token",
  source: "raindrop_oauth",
  async *parse({ token }): AsyncIterable<ImportYield> {
    const collectionMap = await buildCollectionMap(token);
    let page = 0;
    while (true) {
      const response = await fetchRaindrops(token, page);
      if (!response) {
        yield {
          __error: "Failed to fetch Raindrop bookmarks",
          item: "raindrop_api",
        };
        return;
      }
      if (response.items.length === 0) {
        return;
      }
      for (const item of response.items) {
        yield buildRecord(item, collectionMap);
      }
      if (response.items.length < PER_PAGE) {
        return;
      }
      page += 1;
    }
  },
};

function buildRecord(
  item: Raindrop,
  collectionMap: Map<number, string[]>
): ImportRecord {
  const collectionPath = item.collection?.$id
    ? collectionMap.get(item.collection.$id)
    : undefined;
  const createdAt = item.created ? Date.parse(item.created) : undefined;
  const updatedAt = item.lastUpdate ? Date.parse(item.lastUpdate) : undefined;
  const tagNames = item.tags && item.tags.length > 0 ? item.tags : undefined;

  return {
    sourceItemId: `raindrop:${item._id}`,
    type: "website",
    title: item.title || item.link,
    url: item.link,
    description: item.excerpt || item.note,
    collectionPath,
    tagNames,
    createdAt: Number.isNaN(createdAt) ? undefined : createdAt,
    updatedAt: Number.isNaN(updatedAt) ? undefined : updatedAt,
    isFavorite: item.important,
  };
}

async function buildCollectionMap(
  token: string
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  const roots = await fetchCollections(token, "/collections");
  const children = await fetchCollections(token, "/collections/childrens");
  if (!(roots && children)) {
    return map;
  }

  const all = [...roots.items, ...children.items];
  const byId = new Map<number, RaindropCollection>();
  for (const c of all) {
    byId.set(c._id, c);
  }

  const resolvePath = (id: number, seen: Set<number>): string[] => {
    if (seen.has(id)) {
      return [];
    }
    seen.add(id);
    const node = byId.get(id);
    if (!node) {
      return [];
    }
    if (!node.parent?.$id) {
      return [node.title];
    }
    return [...resolvePath(node.parent.$id, seen), node.title];
  };

  for (const c of all) {
    map.set(c._id, resolvePath(c._id, new Set()));
  }
  return map;
}

function fetchCollections(
  token: string,
  path: string
): Promise<CollectionsResponse | null> {
  return raindropFetch<CollectionsResponse>(token, path);
}

function fetchRaindrops(
  token: string,
  page: number
): Promise<RaindropsResponse | null> {
  const qs = new URLSearchParams({
    perpage: String(PER_PAGE),
    page: String(page),
  });
  return raindropFetch<RaindropsResponse>(
    token,
    `/raindrops/0?${qs.toString()}`
  );
}

async function raindropFetch<T>(
  token: string,
  path: string
): Promise<T | null> {
  const url = `${RAINDROP_BASE}${path}`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await sleep(RATE_LIMIT_MS);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) {
      await sleep(BACKOFF_MS);
      continue;
    }
    return null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

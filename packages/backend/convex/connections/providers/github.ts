import { markdownToHtml } from "../../imports/parsers/util/markdownToHtml";
import type {
  OAuth2ProviderDescriptor,
  ProviderSync,
  ResourceUpsert,
  WebhookEvent,
  WebhookParseResult,
} from "./types";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "omi-app";

interface GitHubUser {
  avatar_url?: string;
  id: number;
  login: string;
  name?: string | null;
}

interface GitHubAuthor {
  login?: string;
}

interface GitHubIssueOrPr {
  body: string | null;
  draft?: boolean;
  html_url: string;
  id: number;
  merged?: boolean;
  // present on PR payloads
  merged_at?: string | null;
  number: number;
  pull_request?: { merged_at?: string | null } | unknown;
  state: "open" | "closed";
  title: string;
  user?: GitHubAuthor | null;
}

interface GitHubRepository {
  full_name: string; // "owner/name"
}

interface GitHubWebhookPayload {
  action?: string;
  hook_id?: number;
  issue?: GitHubIssueOrPr;
  pull_request?: GitHubIssueOrPr;
  repository?: GitHubRepository;
  zen?: string; // present on `ping` events
}

type IssueOrPrKind = "issue" | "pr";

async function ghFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub ${init?.method ?? "GET"} ${url} ${response.status}: ${body.slice(0, 200)}`
    );
  }
  return (await response.json()) as T;
}

async function verifyHmacSha256(
  body: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }
  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < hex.length; i += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: <>
    mismatch |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function externalIdFor(
  kind: IssueOrPrKind,
  repoFullName: string,
  number: number
): string {
  return `${kind}:${repoFullName}/${number}`;
}

const EXTERNAL_ID_RE = /^(issue|pr):([^/]+)\/([^/]+)\/(\d+)$/;
function parseExternalId(
  externalId: string
): { kind: IssueOrPrKind; owner: string; repo: string; number: number } | null {
  const match = externalId.match(EXTERNAL_ID_RE);
  if (!match) {
    return null;
  }
  return {
    kind: match[1] as IssueOrPrKind,
    owner: match[2] as string,
    repo: match[3] as string,
    number: Number(match[4]),
  };
}

interface GitHubRawItem {
  kind: IssueOrPrKind;
  payload: GitHubIssueOrPr;
  repoFullName: string;
}

function prState(pr: GitHubIssueOrPr): string {
  if (pr.merged || pr.merged_at) {
    return "merged";
  }
  if (pr.state === "open" && pr.draft) {
    return "draft";
  }
  return pr.state;
}

const githubSync: ProviderSync = {
  kind: "webhook",

  // biome-ignore lint/correctness/useYield: intentional empty generator
  // biome-ignore lint/suspicious/useAwait: <>
  async *pollDelta() {
    return;
  },

  async parseWebhook(req, secret): Promise<WebhookParseResult | null> {
    const body = await req.text();
    let payload: GitHubWebhookPayload;
    try {
      payload = JSON.parse(body) as GitHubWebhookPayload;
    } catch {
      return null;
    }

    if (!secret) {
      console.warn("[github] webhook handler missing per-connection secret");
      return null;
    }
    const ok = await verifyHmacSha256(
      body,
      req.headers.get("X-Hub-Signature-256"),
      secret
    );
    if (!ok) {
      return null;
    }

    const eventType = req.headers.get("X-GitHub-Event");
    const deliveryId =
      req.headers.get("X-GitHub-Delivery") ?? `${Date.now()}:${Math.random()}`;

    if (eventType === "ping" || payload.zen) {
      return { kind: "events", events: [] };
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return { kind: "events", events: [] };
    }

    const events: WebhookEvent[] = [];

    if (eventType === "issues" && payload.issue) {
      const isDelete = payload.action === "deleted";
      events.push({
        kind: isDelete ? "delete" : "upsert",
        externalId: externalIdFor("issue", repoFullName, payload.issue.number),
        eventId: deliveryId,
        rawItem: {
          kind: "issue",
          repoFullName,
          payload: payload.issue,
        } satisfies GitHubRawItem,
      });
    } else if (eventType === "pull_request" && payload.pull_request) {
      const isDelete = payload.action === "deleted";
      events.push({
        kind: isDelete ? "delete" : "upsert",
        externalId: externalIdFor(
          "pr",
          repoFullName,
          payload.pull_request.number
        ),
        eventId: deliveryId,
        rawItem: {
          kind: "pr",
          repoFullName,
          payload: payload.pull_request,
        } satisfies GitHubRawItem,
      });
    }

    return { kind: "events", events };
  },

  async fetchOne(ctx, externalId): Promise<unknown | null> {
    const parsed = parseExternalId(externalId);
    if (!parsed) {
      return null;
    }
    const path = parsed.kind === "issue" ? "issues" : "pulls";
    try {
      const item = await ghFetch<GitHubIssueOrPr>(
        `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/${path}/${parsed.number}`,
        ctx.accessToken
      );
      return {
        kind: parsed.kind,
        repoFullName: `${parsed.owner}/${parsed.repo}`,
        payload: item,
      } satisfies GitHubRawItem;
    } catch {
      return null;
    }
  },

  toResource(rawItem): ResourceUpsert {
    const item = rawItem as GitHubRawItem;
    const { kind, repoFullName, payload } = item;
    const author = payload.user?.login ?? "unknown";
    const state = kind === "pr" ? prState(payload) : payload.state;
    const description = `${kind === "pr" ? "PR" : "Issue"} #${payload.number} · ${state} · @${author} · ${repoFullName}`;
    const html = payload.body
      ? markdownToHtml(payload.body)
      : "<p><em>(no description)</em></p>";

    return {
      externalId: externalIdFor(kind, repoFullName, payload.number),
      externalUrl: payload.html_url,
      type: "website",
      title: payload.title,
      description,
      website: {
        url: payload.html_url,
        domain: "github.com",
        favicon: "https://github.githubassets.com/favicons/favicon.svg",
        ogTitle: payload.title,
        ogDescription: description,
        siteName: "GitHub",
        articleContent: html,
      },
    };
  },
};

export const github: OAuth2ProviderDescriptor = {
  id: "github",
  label: "GitHub",
  authType: "oauth2",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: process.env.GITHUB_SCOPES?.split(/\s+/).filter(Boolean) ?? ["repo"],
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  tokenAuthStyle: "header",
  fetchAccountInfo: async (accessToken) => {
    const me = await ghFetch<GitHubUser>(`${GITHUB_API}/user`, accessToken);
    return {
      providerAccountId: String(me.id),
      providerAccountLabel: me.login,
    };
  },
  sync: githubSync,
};

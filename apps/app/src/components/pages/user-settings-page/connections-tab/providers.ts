export type ProviderId = "notion" | "raindrop" | "readwise";

export type AuthType = "oauth2" | "api_token";

export interface UiProviderDescriptor {
  authType: AuthType;
  description: string;
  id: ProviderId;
  label: string;
  tokenHelpUrl?: string;
}

export const UI_PROVIDERS: UiProviderDescriptor[] = [
  {
    id: "readwise",
    label: "Readwise",
    description:
      "Import highlights from books, articles, podcasts, and tweets using an API token.",
    authType: "api_token",
    tokenHelpUrl: "https://readwise.io/access_token",
  },
  {
    id: "notion",
    label: "Notion",
    description:
      "Import pages and databases from a Notion workspace. Reconnect any time.",
    authType: "oauth2",
  },
  {
    id: "raindrop",
    label: "Raindrop.io",
    description:
      "Import bookmarks, collections, and highlights from your Raindrop account.",
    authType: "oauth2",
  },
];

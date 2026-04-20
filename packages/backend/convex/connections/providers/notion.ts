import type { OAuth2ProviderDescriptor } from "./types";

interface NotionBotUser {
  bot?: {
    workspace_name?: string;
    owner?: { user?: { person?: { email?: string }; name?: string } };
  };
  id: string;
  name?: string;
}

export const notion: OAuth2ProviderDescriptor = {
  id: "notion",
  label: "Notion",
  authType: "oauth2",
  authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
  scopes: [],
  clientId: process.env.NOTION_CLIENT_ID,
  clientSecret: process.env.NOTION_CLIENT_SECRET,
  authorizeExtraParams: {
    owner: "user",
    response_type: "code",
  },
  tokenAuthStyle: "header",
  fetchAccountInfo: async (accessToken) => {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (!response.ok) {
      throw new Error(`Notion /users/me failed: ${response.status}`);
    }
    const me = (await response.json()) as NotionBotUser;
    const workspaceName = me.bot?.workspace_name;
    const ownerEmail = me.bot?.owner?.user?.person?.email;
    const ownerName = me.bot?.owner?.user?.name;
    const label =
      workspaceName ?? ownerEmail ?? ownerName ?? me.name ?? "Notion workspace";
    return { providerAccountId: me.id, providerAccountLabel: label };
  },
};

import type { OAuth2ProviderDescriptor } from "./types";

interface RaindropMe {
  user?: {
    _id?: number;
    fullName?: string;
    email?: string;
  };
}

export const raindrop: OAuth2ProviderDescriptor = {
  id: "raindrop",
  label: "Raindrop.io",
  authType: "oauth2",
  authorizeUrl: "https://raindrop.io/oauth/authorize",
  tokenUrl: "https://raindrop.io/oauth/access_token",
  scopes: [],
  clientId: process.env.RAINDROP_CLIENT_ID,
  clientSecret: process.env.RAINDROP_CLIENT_SECRET,
  tokenAuthStyle: "body",
  fetchAccountInfo: async (accessToken) => {
    const response = await fetch("https://api.raindrop.io/rest/v1/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Raindrop /user failed: ${response.status}`);
    }
    const body = (await response.json()) as RaindropMe;
    const user = body.user;
    const label = user?.email ?? user?.fullName ?? "Raindrop account";
    return {
      providerAccountId: user?._id ? String(user._id) : undefined,
      providerAccountLabel: label,
    };
  },
};

import type { OAuth2ProviderDescriptor } from "./types";

interface GoogleUserInfo {
  email?: string;
  name?: string;
  sub: string;
}

export const googleDrive: OAuth2ProviderDescriptor = {
  id: "google_drive",
  label: "Google Drive",
  authType: "oauth2",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: ["https://www.googleapis.com/auth/drive.readonly", "openid", "email"],
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  authorizeExtraParams: {
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  },
  tokenAuthStyle: "body",
  fetchAccountInfo: async (accessToken) => {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      throw new Error(`Google userinfo failed: ${response.status}`);
    }
    const info = (await response.json()) as GoogleUserInfo;
    return {
      providerAccountId: info.sub,
      providerAccountLabel: info.email ?? info.name ?? "Google account",
    };
  },
};

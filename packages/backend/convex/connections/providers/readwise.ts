import type { ApiTokenProviderDescriptor } from "./types";

export const readwise: ApiTokenProviderDescriptor = {
  id: "readwise",
  label: "Readwise",
  authType: "api_token",
  validateToken: async (token) => {
    const response = await fetch("https://readwise.io/api/v2/auth/", {
      method: "GET",
      headers: { Authorization: `Token ${token}` },
    });
    if (response.status === 204) {
      return { providerAccountLabel: "Readwise account" };
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid Readwise API token");
    }
    throw new Error(
      `Readwise token validation failed (status ${response.status})`
    );
  },
};

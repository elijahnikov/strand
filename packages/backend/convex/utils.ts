import { ConvexError } from "convex/values";

const authErrorMessageRegex = /auth/i;
export const isAuthError = (error: unknown) => {
  const message =
    (error instanceof ConvexError && error.data) ||
    (error instanceof Error && error.message) ||
    "";
  return authErrorMessageRegex.test(message);
};

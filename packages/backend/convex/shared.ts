import { ConvexError } from "convex/values";

const UNAUTHENTICATED_PATTERN = /not authenticated|user not found/i;
const MISSING_OR_FORBIDDEN_PATTERN =
  /not authorized|not a member|not found|ArgumentValidationError|does not match validator/i;

function messageOf(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "";
}

export const isUnauthenticatedError = (error: unknown) =>
  UNAUTHENTICATED_PATTERN.test(messageOf(error));

/**
 * Forbidden and not-found are intentionally conflated so the UI cannot leak
 * workspace existence to non-members.
 */
export const isMissingOrForbiddenError = (error: unknown) =>
  MISSING_OR_FORBIDDEN_PATTERN.test(messageOf(error));

/** @deprecated use isUnauthenticatedError */
export const isAuthError = isUnauthenticatedError;

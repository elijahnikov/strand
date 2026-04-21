import { AuthBoundary } from "@convex-dev/better-auth/react";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { isUnauthenticatedError } from "@omi/backend/shared.js";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/register",
  "/verify-email",
  "/connect-extension",
]);

export const ClientAuthBoundary = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <AuthBoundary
      authClient={authClient}
      getAuthUserFn={api.user.queries.currentUser}
      isAuthError={isUnauthenticatedError}
      onUnauth={() => {
        if (PUBLIC_PATHS.has(location.pathname)) {
          return;
        }
        navigate({ to: "/login" });
      }}
    >
      {children}
    </AuthBoundary>
  );
};

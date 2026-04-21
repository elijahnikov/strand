import { AuthBoundary } from "@convex-dev/better-auth/react";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { isUnauthenticatedError } from "@omi/backend/shared.js";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

export const ClientAuthBoundary = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <AuthBoundary
      authClient={authClient}
      getAuthUserFn={api.user.queries.currentUser}
      isAuthError={isUnauthenticatedError}
      onUnauth={() => {
        if (
          location.pathname === "/login" ||
          location.pathname === "/connect-extension"
        ) {
          return;
        }
        navigate({ to: "/login" });
      }}
    >
      {children}
    </AuthBoundary>
  );
};

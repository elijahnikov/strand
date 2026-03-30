import { AuthBoundary } from "@convex-dev/better-auth/react";
import { authClient } from "@strand/auth/client";
import { api } from "@strand/backend/_generated/api.js";
import { isAuthError } from "@strand/backend/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

export const ClientAuthBoundary = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <AuthBoundary
      authClient={authClient}
      getAuthUserFn={api.auth.getAuthUser}
      isAuthError={isAuthError}
      onUnauth={() => {
        if (location.pathname !== "/login") {
          navigate({ to: "/login" });
        }
      }}
    >
      {children}
    </AuthBoundary>
  );
};

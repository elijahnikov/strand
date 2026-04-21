import { convexQuery } from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { Button } from "@omi/ui/button";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ClientAuthBoundary } from "~/lib/auth-client";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      return;
    }
    const workspaces = await context.queryClient.ensureQueryData(
      convexQuery(api.workspace.queries.listByUser, {})
    );
    const target = workspaces[0];
    if (target) {
      throw redirect({
        to: "/workspace/$workspaceId",
        params: { workspaceId: target._id },
      });
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  return (
    <ClientAuthBoundary>
      <main className="container h-screen py-16">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
            Create <span className="text-primary">T3</span> Turbo
          </h1>

          <Button
            onClick={async () => {
              const res = await authClient.signIn.social({
                provider: "discord",
                callbackURL: "/",
              });
              if (!res.data?.url) {
                throw new Error("No URL returned from signInSocial");
              }
              await navigate({ href: res.data.url, replace: true });
            }}
            size="base"
          >
            Sign in with Discord
          </Button>
          <Button
            onClick={async () => {
              const res = await authClient.signIn.social({
                provider: "google",
                callbackURL: "/",
              });
              if (!res.data?.url) {
                throw new Error("No URL returned from signInSocial");
              }
              await navigate({ href: res.data.url, replace: true });
            }}
            size="base"
          >
            Sign in with Google
          </Button>
        </div>
        <pre className="font-mono">{JSON.stringify(session, null, 2)}</pre>
      </main>
    </ClientAuthBoundary>
  );
}

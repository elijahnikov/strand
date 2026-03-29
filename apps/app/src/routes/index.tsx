import { convexQuery } from "@convex-dev/react-query";
import { authClient } from "@strand/auth/client";
import { api } from "@strand/backend/api";
import { Button } from "@strand/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useSuspenseQuery(convexQuery(api.tasks.get, {}));
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  return (
    <main className="container h-screen py-16">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
          Create <span className="text-primary">T3</span> Turbo
        </h1>
        {data.map(({ _id, text }) => (
          <div key={_id}>{text}</div>
        ))}
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
      </div>
      <pre className="font-mono">{JSON.stringify(session, null, 2)}</pre>
    </main>
  );
}

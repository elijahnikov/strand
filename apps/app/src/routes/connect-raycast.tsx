import { useConvexMutation } from "@convex-dev/react-query";
import { authClient } from "@omi/auth/client";
import { api } from "@omi/backend/_generated/api.js";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { useMutation } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

interface Search {
  author: string;
  extension: string;
  state: string;
}

export const Route = createFileRoute("/connect-raycast")({
  component: ConnectRaycastRoute,
  validateSearch: (search: Record<string, unknown>): Search => ({
    author: typeof search.author === "string" ? search.author : "",
    extension: typeof search.extension === "string" ? search.extension : "",
    state: typeof search.state === "string" ? search.state : "",
  }),
});

function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

type Phase = "idle" | "connecting" | "redirecting" | "success" | "error";

function ConnectRaycastRoute() {
  const search = Route.useSearch();
  const { isAuthenticated } = useRouteContext({ from: "__root__" });

  if (!(isValidSlug(search.author) && isValidSlug(search.extension))) {
    return <InvalidScreen />;
  }

  if (!isAuthenticated) {
    return <SignInPromptScreen search={search} />;
  }

  return <ConfirmScreen search={search} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ui-bg-subtle p-6">
      <div className="w-full max-w-md rounded-xl border-[0.5px] bg-ui-bg-base p-8">
        {children}
      </div>
    </div>
  );
}

function InvalidScreen() {
  return (
    <Shell>
      <Heading>Invalid request</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        Open this page from the omi Raycast extension's "Connect omi" command.
      </Text>
    </Shell>
  );
}

function SignInPromptScreen({ search }: { search: Search }) {
  const navigate = useNavigate();
  const params = new URLSearchParams({
    author: search.author,
    extension: search.extension,
    state: search.state,
  });
  const redirectTarget = `/connect-raycast?${params.toString()}`;
  return (
    <Shell>
      <Heading>Connect Raycast to omi</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        Sign in to link Raycast to your account. You'll come back here
        automatically.
      </Text>
      <Button
        className="mt-6 w-full"
        onClick={() => {
          void navigate({
            to: "/login",
            search: { redirect: redirectTarget },
          });
        }}
        size="base"
      >
        Sign in
      </Button>
    </Shell>
  );
}

function buildRaycastDeepLink(
  search: Search,
  payload: {
    token: string;
    userId: string;
    defaultWorkspaceId: string | null;
    expiresAt: number;
  }
): string {
  const launchContext = encodeURIComponent(
    JSON.stringify({
      token: payload.token,
      userId: payload.userId,
      defaultWorkspaceId: payload.defaultWorkspaceId,
      expiresAt: payload.expiresAt,
      state: search.state,
    })
  );
  return `raycast://extensions/${search.author}/${search.extension}/connect?launchContext=${launchContext}`;
}

function ConfirmScreen({ search }: { search: Search }) {
  const { data: session } = authClient.useSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: mintToken } = useMutation({
    mutationFn: useConvexMutation(
      api.extensionAuth.mutations.mintExtensionToken
    ),
  });

  const handleConnect = async () => {
    setError(null);
    setPhase("connecting");
    try {
      const result = await mintToken({ label: "Raycast" });
      setPhase("redirecting");
      const deepLink = buildRaycastDeepLink(search, result);
      window.location.href = deepLink;
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  if (phase === "success") {
    return (
      <Shell>
        <Heading>Raycast connected</Heading>
        <Text className="mt-2 text-ui-fg-muted" size="small">
          Raycast should now be ready to use omi. You can close this tab.
        </Text>
      </Shell>
    );
  }

  return (
    <Shell>
      <Heading>Connect Raycast to omi</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        This will give Raycast permission to save captures to your workspace and
        list your saved resources. You can revoke access any time in settings.
      </Text>

      <dl className="mt-6 space-y-2 rounded-md border border-ui-border-subtle bg-ui-bg-subtle p-4 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-ui-fg-subtle">Signed in as</dt>
          <dd className="truncate font-medium font-mono">
            {session?.user?.email ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ui-fg-subtle">Extension</dt>
          <dd className="truncate font-mono">
            {search.author}/{search.extension}
          </dd>
        </div>
      </dl>

      {error ? (
        <Text className="mt-3 text-ui-fg-error" size="xsmall">
          {error}
        </Text>
      ) : null}

      <LoadingButton
        className="mt-6 w-full"
        loading={phase === "connecting" || phase === "redirecting"}
        onClick={() => void handleConnect()}
        size="base"
      >
        {phase === "redirecting" ? "Opening Raycast…" : "Connect Raycast"}
      </LoadingButton>
    </Shell>
  );
}

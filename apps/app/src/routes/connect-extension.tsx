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

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

interface Search {
  extId: string;
}

export const Route = createFileRoute("/connect-extension")({
  component: ConnectExtensionRoute,
  validateSearch: (search: Record<string, unknown>): Search => {
    const extId = typeof search.extId === "string" ? search.extId : "";
    return { extId };
  },
});

function isKnownExtensionId(id: string): boolean {
  if (EXTENSION_ID_PATTERN.test(id)) {
    return true;
  }
  const allowlist = (
    import.meta.env.VITE_EXTENSION_ID_ALLOWLIST as string | undefined
  )
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowlist?.includes(id) ?? false;
}

type Phase = "idle" | "connecting" | "posting" | "success" | "error";

function ConnectExtensionRoute() {
  const { extId } = Route.useSearch();
  const { isAuthenticated } = useRouteContext({ from: "__root__" });

  if (!isKnownExtensionId(extId)) {
    return <InvalidExtensionScreen extId={extId} />;
  }

  if (!isAuthenticated) {
    return <SignInPromptScreen extId={extId} />;
  }

  return <ConfirmScreen extId={extId} />;
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

function InvalidExtensionScreen({ extId }: { extId: string }) {
  return (
    <Shell>
      <Heading>Unknown extension</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        The extension ID <code className="font-mono">{extId || "(none)"}</code>{" "}
        is not recognised. Open this page from the omi browser extension.
      </Text>
    </Shell>
  );
}

function SignInPromptScreen({ extId }: { extId: string }) {
  const navigate = useNavigate();
  const redirectTarget = `/connect-extension?extId=${encodeURIComponent(extId)}`;
  return (
    <Shell>
      <Heading>Connect the omi extension</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        Sign in to link the extension to your account. You'll come back here
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
      <Text className="mt-4 text-ui-fg-subtle" size="xsmall">
        Extension: <code className="font-mono">{extId}</code>
      </Text>
    </Shell>
  );
}

function ConfirmScreen({ extId }: { extId: string }) {
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
      const result = await mintToken({ label: "Chrome extension" });
      setPhase("posting");
      await sendTokenToExtension(extId, result);
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  if (phase === "success") {
    return (
      <Shell>
        <Heading>Extension connected</Heading>
        <Text className="mt-2 text-ui-fg-muted" size="small">
          You can close this tab. The extension is ready to save to your
          workspace.
        </Text>
      </Shell>
    );
  }

  return (
    <Shell>
      <Heading>Connect the omi extension</Heading>
      <Text className="mt-2 text-ui-fg-muted" size="small">
        This will give the extension permission to save captures to your
        workspace. You can revoke access any time in settings.
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
          <dd className="truncate font-mono">{extId}</dd>
        </div>
      </dl>

      {error ? (
        <Text className="mt-3 text-ui-fg-error" size="xsmall">
          {error}
        </Text>
      ) : null}

      <LoadingButton
        className="mt-6 w-full"
        loading={phase === "connecting" || phase === "posting"}
        onClick={() => void handleConnect()}
        size="base"
      >
        {phase === "posting" ? "Finishing…" : "Connect extension"}
      </LoadingButton>
    </Shell>
  );
}

interface ExtensionHandshakePayload {
  defaultWorkspaceId: string | null;
  expiresAt: number;
  token: string;
  userId: string;
}

function sendTokenToExtension(
  extId: string,
  payload: ExtensionHandshakePayload
): Promise<void> {
  return new Promise((resolve, reject) => {
    const runtime = (
      globalThis as unknown as {
        chrome?: {
          runtime?: {
            sendMessage: (
              extId: string,
              message: unknown,
              callback: (response: unknown) => void
            ) => void;
            lastError?: { message: string };
          };
        };
      }
    ).chrome?.runtime;

    if (!runtime?.sendMessage) {
      reject(
        new Error(
          "chrome.runtime.sendMessage is unavailable. Open this page from the omi extension popup."
        )
      );
      return;
    }

    runtime.sendMessage(
      extId,
      {
        type: "EXTENSION_TOKEN",
        token: payload.token,
        userId: payload.userId,
        defaultWorkspaceId: payload.defaultWorkspaceId ?? undefined,
        expiresAt: payload.expiresAt,
      },
      (response) => {
        const lastError = runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        const ok =
          typeof response === "object" &&
          response !== null &&
          (response as { ok?: boolean }).ok === true;
        if (!ok) {
          reject(new Error("Extension did not acknowledge the token"));
          return;
        }
        resolve();
      }
    );
  });
}

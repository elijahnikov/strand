import {
  convexQuery,
  useConvexAction,
  useConvexMutation,
} from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Notion,
  Raindrop,
} from "~/components/pages/settings-page/import-tab/integration-logos";

const TOTAL_STEPS = 5;

interface Workspace {
  _id: Id<"workspace">;
  name: string;
}

export function OnboardingPageComponent({ step }: { step: number }) {
  const navigate = useNavigate();

  const { data: workspaces } = useSuspenseQuery(
    convexQuery(api.workspace.queries.listByUser, {})
  );
  const workspace = workspaces[0] as Workspace | undefined;

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: useConvexMutation(api.user.mutations.completeOnboarding),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connections");
    if (!connected) {
      return;
    }
    if (connected === "error") {
      const reason = params.get("reason") ?? "unknown_error";
      toastManager.add({
        type: "error",
        title: "Could not connect",
        description: reason,
      });
    } else {
      toastManager.add({ type: "success", title: "Connected" });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("connections");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const goToStep = (next: number) =>
    navigate({
      to: "/onboarding",
      search: { step: next },
      replace: true,
    });

  const finish = () => {
    if (!workspace) {
      return;
    }
    complete(
      {},
      {
        onSuccess: () => {
          navigate({
            to: "/workspace/$workspaceId",
            params: { workspaceId: workspace._id },
          });
        },
        onError: () => {
          toastManager.add({
            type: "error",
            title: "Could not finish onboarding",
          });
        },
      }
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-ui-bg-base">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex items-center gap-2">
          <img
            alt="omi"
            className="rounded-lg dark:block"
            height={32}
            src="/omi_white_on_transparent.png"
            width={32}
          />
          <img
            alt="omi"
            className="rounded-lg dark:hidden"
            height={32}
            src="/omi_black_on_transparent.png"
            width={32}
          />
          <span className="font-semibold text-ui-fg-base">omi</span>
        </div>
        <Button
          disabled={completing || !workspace}
          onClick={finish}
          size="small"
          variant="secondary"
        >
          Skip onboarding
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pt-20 pb-8">
        <div className="mb-8">
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>
        <div className="flex flex-1 flex-col gap-6 pb-12">
          <StepContent
            onAdvance={() => goToStep(Math.min(step + 1, TOTAL_STEPS))}
            onBack={
              step > 1 ? () => goToStep(Math.max(step - 1, 1)) : undefined
            }
            onFinish={finish}
            step={step}
            workspace={workspace}
          />
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const isActive = n === current;
        const isDone = n < current;
        return (
          <div
            className={`h-1.5 rounded-full transition-all ${
              isActive ? "w-6 bg-ui-fg-base" : "w-1.5"
            } ${
              isActive ? "" : isDone ? "bg-ui-fg-muted" : "bg-ui-bg-component"
            }`}
            key={n}
          />
        );
      })}
    </div>
  );
}

interface StepProps {
  onAdvance: () => void;
  onBack: (() => void) | undefined;
  onFinish: () => void;
  step: number;
  workspace: Workspace | undefined;
}

function StepContent(props: StepProps) {
  switch (props.step) {
    case 1:
      return <WelcomeStep {...props} />;
    case 2:
      return <ConnectStep {...props} />;
    case 3:
      return <UploadStep {...props} />;
    case 4:
      return <SaveFirstResourceStep {...props} />;
    default:
      return <DoneStep {...props} />;
  }
}

function StepNav({
  onBack,
  primary,
  secondary,
}: {
  onBack: (() => void) | undefined;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 pt-16">
      <div>
        {onBack && (
          <Button onClick={onBack} size="small" variant="secondary">
            <ArrowLeftIcon className="size-3" />
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  );
}

function WelcomeStep({ onAdvance }: StepProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Heading>Welcome to omi</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          omi is your second brain — save links, notes, and files, then ask AI
          across everything you've collected. Let's get a few things set up so
          your library feels like home.
        </Text>
      </div>
      <StepNav
        onBack={undefined}
        primary={
          <Button onClick={onAdvance} size="small" variant="omi">
            Get started
            <ArrowRightIcon className="size-3" />
          </Button>
        }
      />
    </>
  );
}

const OAUTH_PROVIDERS: {
  id: "notion" | "raindrop";
  label: string;
  Logo: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "notion", label: "Notion", Logo: Notion },
  { id: "raindrop", label: "Raindrop", Logo: Raindrop },
];

function ConnectStep({ onAdvance, onBack }: StepProps) {
  const { data: connections } = useSuspenseQuery(
    convexQuery(api.connections.queries.listMyConnections, {})
  );

  const connectedProviders = new Set(
    connections.filter((c) => c.status !== "revoked").map((c) => c.provider)
  );

  const { mutate: getAuthorizeUrl, isPending } = useMutation({
    mutationFn: useConvexAction(
      api.connections.oauth.authorize.getAuthorizeUrl
    ),
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (err) => {
      const message =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : err instanceof Error
            ? err.message
            : "Unknown error";
      toastManager.add({
        type: "error",
        title: "Could not start connection",
        description: message,
      });
    },
  });

  const handleConnect = (provider: "notion" | "raindrop") => {
    const returnTo = `${window.location.origin}/onboarding?step=2&connections=${provider}`;
    getAuthorizeUrl({ provider, returnTo });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Heading>Connect a source</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Pull in your existing knowledge from Notion or Raindrop. Everything
          syncs in the background — you can keep going while it imports.
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        {OAUTH_PROVIDERS.map((p) => {
          const connected = connectedProviders.has(p.id);
          return (
            <Button
              disabled={isPending || connected}
              key={p.id}
              onClick={() => handleConnect(p.id)}
              size="small"
              variant="secondary"
            >
              <p.Logo className="size-4 shrink-0" />
              {connected ? (
                <>
                  {p.label} connected
                  <CheckIcon className="size-3 text-ui-fg-success" />
                </>
              ) : (
                <>Connect {p.label}</>
              )}
            </Button>
          );
        })}
      </div>
      <StepNav
        onBack={onBack}
        primary={
          <Button onClick={onAdvance} size="small" variant="omi">
            {connectedProviders.size > 0 ? "Continue" : "Skip for now"}
            <ArrowRightIcon className="size-3" />
          </Button>
        }
      />
    </>
  );
}

function UploadStep({ onAdvance, onBack, workspace }: StepProps) {
  const navigate = useNavigate();

  const goToImport = () => {
    if (!workspace) {
      return;
    }
    navigate({
      to: "/workspace/$workspaceId/settings",
      params: { workspaceId: workspace._id },
      search: { tab: "import" },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Heading>Upload an export</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Bring an export from Fabric, MyMind, Notion, Evernote, or your browser
          bookmarks. We'll handle the parsing and add everything to your
          library.
        </Text>
      </div>
      <div>
        <Button
          disabled={!workspace}
          onClick={goToImport}
          size="small"
          variant="secondary"
        >
          Choose a file
        </Button>
      </div>
      <StepNav
        onBack={onBack}
        primary={
          <Button onClick={onAdvance} size="small" variant="omi">
            Continue
            <ArrowRightIcon className="size-3" />
          </Button>
        }
      />
    </>
  );
}

function SaveFirstResourceStep({ onAdvance, onBack, workspace }: StepProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate: createResource, isPending } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.create),
    onSuccess: () => {
      setUrl("");
      toastManager.add({ type: "success", title: "Saved to your library" });
      onAdvance();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not save");
    },
    meta: { customErrorToast: true },
  });

  const handleSave = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!(trimmed && workspace)) {
      return;
    }
    if (!URL.canParse(trimmed)) {
      setError("Enter a valid URL (including https://)");
      return;
    }
    createResource({
      workspaceId: workspace._id,
      type: "website",
      title: trimmed,
      url: trimmed,
    });
  };

  return (
    <form className="flex flex-1 flex-col gap-6" onSubmit={handleSave}>
      <div className="flex flex-col gap-2">
        <Heading>Save your first resource</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Paste any URL — an article, video, doc — and we'll save it with
          metadata, screenshots, and search-ready content.
        </Text>
      </div>
      <div>
        <Input
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://..."
          value={url}
        />
        {error && <p className="mt-1 text-destructive text-xs">{error}</p>}
      </div>
      <StepNav
        onBack={onBack}
        primary={
          <LoadingButton
            disabled={!(url.trim() && workspace)}
            loading={isPending}
            size="small"
            type="submit"
            variant="omi"
          >
            Save
            <ArrowRightIcon className="size-3" />
          </LoadingButton>
        }
        secondary={
          <Button onClick={onAdvance} size="small" variant="secondary">
            Skip
          </Button>
        }
      />
    </form>
  );
}

function DoneStep({ onBack, onFinish }: StepProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Heading>You're all set</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Your workspace is ready. You can always import more, connect new
          sources, or save resources from anywhere — Cmd+K is your friend.
        </Text>
      </div>
      <StepNav
        onBack={onBack}
        primary={
          <Button onClick={onFinish} size="small" variant="omi">
            Go to your workspace
            <ArrowRightIcon className="size-3" />
          </Button>
        }
      />
    </>
  );
}

import {
  convexQuery,
  useConvexAction,
  useConvexMutation,
} from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  BYO_MODELS,
  type BYOProvider,
  defaultModelFor,
} from "@omi/backend/billing/byoModels.js";
import { Badge } from "@omi/ui/badge";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@omi/ui/select";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { useState } from "react";

type Provider = BYOProvider;

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  google: "Google",
  anthropic: "Anthropic",
};

const PROVIDER_KEY_PLACEHOLDER: Record<Provider, string> = {
  openai: "sk-…",
  google: "Google Generative AI API key",
  anthropic: "sk-ant-…",
};

function formatRelativeDate(ts: number | null | undefined): string {
  if (!ts) {
    return "just now";
  }
  const diffMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

export function AIProviderTab({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery(
    convexQuery(api.billing.byoKey.getWorkspaceProvider, { workspaceId })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: convexQuery(api.billing.byoKey.getWorkspaceProvider, {
        workspaceId,
      }).queryKey,
    });

  const setAction = useConvexAction(api.billing.byoKeyActions.setWorkspaceKey);

  const { mutate: saveKey, isPending: savePending } = useMutation({
    mutationFn: (args: {
      provider: Provider;
      apiKey: string;
      model?: string;
    }) => setAction({ workspaceId, ...args }),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "AI provider saved",
        description:
          "Your API key was verified and stored. This workspace will now use your own provider.",
      });
      invalidate();
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not save API key",
        description:
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : err instanceof Error
              ? err.message
              : "Unknown error",
      });
    },
  });

  const { mutate: removeKey, isPending: removePending } = useMutation({
    mutationFn: useConvexMutation(api.billing.byoKey.removeWorkspaceKey),
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "AI provider removed",
        description: "This workspace will fall back to the platform default.",
      });
      invalidate();
    },
    onError: (err) => {
      toastManager.add({
        type: "error",
        title: "Could not remove API key",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  if (isLoading || !state) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <Heading>AI provider</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Bring your own OpenAI, Google, or Anthropic key.
          </Text>
        </div>
        <Text className="text-ui-fg-subtle" size="small">
          Loading…
        </Text>
      </div>
    );
  }

  const currentProvider = (state.provider ?? "openai") as Provider;
  const currentModel = state.model ?? defaultModelFor(currentProvider);

  return (
    <div className="w-full">
      <div className="mb-6">
        <Heading>AI provider</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Bring your own OpenAI, Google, or Anthropic key to remove AI-action
          limits for this workspace. Storage quotas still apply.
        </Text>
      </div>

      {state.hasKey ? (
        <CurrentProviderCard
          isAdmin={state.isAdmin}
          lastValidatedAt={state.lastValidatedAt}
          model={currentModel}
          onRemove={() => removeKey({ workspaceId })}
          provider={currentProvider}
          removing={removePending}
        />
      ) : (
        <Text className="mb-6 text-ui-fg-subtle" size="small">
          No key set. This workspace is currently using the platform default,
          metered in AI actions.
        </Text>
      )}

      {state.isAdmin ? (
        <KeyForm onSubmit={(vals) => saveKey(vals)} saving={savePending} />
      ) : (
        <Text className="mt-6 text-ui-fg-muted" size="small">
          Only workspace owners and admins can change the AI provider.
        </Text>
      )}
    </div>
  );
}

function CurrentProviderCard({
  provider,
  model,
  lastValidatedAt,
  onRemove,
  isAdmin,
  removing,
}: {
  provider: Provider;
  model: string;
  lastValidatedAt: number | null;
  onRemove: () => void;
  isAdmin: boolean;
  removing: boolean;
}) {
  return (
    <section className="mb-6 flex items-center justify-between rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Text size="small">Using your {PROVIDER_LABEL[provider]} key</Text>
          <Badge size="sm" variant="mono">
            {model}
          </Badge>
        </div>
        <Text className="text-ui-fg-muted" size="xsmall">
          Verified {formatRelativeDate(lastValidatedAt)}
        </Text>
      </div>
      {isAdmin ? (
        <LoadingButton
          loading={removing}
          onClick={onRemove}
          size="small"
          variant="secondary"
        >
          Remove
        </LoadingButton>
      ) : null}
    </section>
  );
}

function KeyForm({
  onSubmit,
  saving,
}: {
  onSubmit: (vals: {
    provider: Provider;
    apiKey: string;
    model?: string;
  }) => void;
  saving: boolean;
}) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(defaultModelFor("openai"));

  return (
    <section className="flex flex-col gap-4 rounded-lg border-[0.5px] bg-ui-bg-field p-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <Text className="font-medium" size="small">
            Provider
          </Text>
          <Select
            onValueChange={(val) => {
              const next = val as Provider;
              setProvider(next);
              setApiKey("");
              setModel(defaultModelFor(next));
            }}
            value={provider}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{PROVIDER_LABEL[provider]}</SelectValue>
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <Text className="font-medium" size="small">
            Model
          </Text>
          <Select
            onValueChange={(val) => {
              if (typeof val === "string") {
                setModel(val);
              }
            }}
            value={model}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{model}</SelectValue>
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              {BYO_MODELS[provider].map((m: string) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Text className="font-medium" size="small">
          API key
        </Text>
        <Input
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={PROVIDER_KEY_PLACEHOLDER[provider]}
          type="password"
          value={apiKey}
        />
        <Text className="text-ui-fg-muted" size="xsmall">
          We verify the key with the provider before saving. It's stored
          encrypted at rest and never shown again.
        </Text>
      </div>

      <div className="flex justify-end">
        <LoadingButton
          disabled={apiKey.trim().length < 10}
          loading={saving}
          onClick={() => onSubmit({ provider, apiKey: apiKey.trim(), model })}
          size="small"
          variant="omi"
        >
          Verify &amp; save
        </LoadingButton>
      </div>
    </section>
  );
}

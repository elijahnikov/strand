import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { Checkbox } from "@omi/ui/checkbox";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { Switch } from "@omi/ui/switch";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useEffect, useMemo, useState } from "react";
import {
  type ConfigConnection,
  DestinationPicker,
  toErrorMessage,
  type WorkspaceOption,
  WorkspacePicker,
} from "../shared";

interface GithubRepo {
  description: string | null;
  fullName: string;
  private: boolean;
}

interface GithubScopeSelection {
  repos?: Array<{ name: string; hookId?: number }>;
  starsEnabled?: boolean;
}

export function GithubSyncForm({
  connection,
  destinationCollectionId,
  onDestinationChange,
  onWorkspaceChange,
  workspaceId,
  workspaces,
}: {
  connection: ConfigConnection;
  destinationCollectionId: Id<"collection"> | undefined;
  onDestinationChange: (next: Id<"collection"> | undefined) => void;
  onWorkspaceChange: (next: Id<"workspace">) => void;
  workspaceId: Id<"workspace"> | undefined;
  workspaces: WorkspaceOption[];
}) {
  const enableSync = useConvexMutation(api.connections.mutations.enableSync);
  const [enabling, setEnabling] = useState(false);
  const repoState = useGithubRepoPicker({
    connectionId: connection._id,
    initialScope: connection.scopeSelection as GithubScopeSelection | undefined,
  });

  const canEnable =
    !!workspaceId &&
    (repoState.selectedRepos.size > 0 || repoState.starsEnabled) &&
    !enabling;

  const handleEnable = async () => {
    if (!workspaceId) {
      return;
    }
    setEnabling(true);
    try {
      await enableSync({
        connectionId: connection._id,
        workspaceId,
        destinationCollectionId,
        scopeSelection: {
          repos: Array.from(repoState.selectedRepos).map((name) => ({ name })),
          starsEnabled: repoState.starsEnabled,
        },
      });
      toastManager.add({
        type: "success",
        title: "Sync enabled",
        description: repoState.starsEnabled
          ? "Webhooks registering. Stars baseline captured shortly."
          : "Webhooks registering on selected repos.",
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not enable sync",
        description: toErrorMessage(err),
      });
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Text className="font-medium" size="small">
        Continuous sync
      </Text>
      <WorkspacePicker
        onChange={onWorkspaceChange}
        value={workspaceId}
        workspaces={workspaces}
      />
      <DestinationPicker
        onChange={onDestinationChange}
        value={destinationCollectionId}
        workspaceId={workspaceId}
      />
      <GithubRepoList state={repoState} />
      <GithubStarsToggle state={repoState} />
      <div>
        <LoadingButton
          disabled={!canEnable}
          loading={enabling}
          onClick={handleEnable}
          size="small"
          variant="omi"
        >
          Enable sync
        </LoadingButton>
      </div>
    </div>
  );
}

export function GithubScopeEditor({
  connection,
  onClose,
}: {
  connection: ConfigConnection;
  onClose: () => void;
}) {
  const setScope = useConvexMutation(
    api.connections.mutations.setScopeSelection
  );
  const [saving, setSaving] = useState(false);
  const repoState = useGithubRepoPicker({
    connectionId: connection._id,
    initialScope: connection.scopeSelection as GithubScopeSelection | undefined,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await setScope({
        connectionId: connection._id,
        scopeSelection: {
          repos: Array.from(repoState.selectedRepos).map((name) => ({ name })),
          starsEnabled: repoState.starsEnabled,
        },
      });
      toastManager.add({
        type: "success",
        title: "Repository selection updated",
      });
      onClose();
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not update repos",
        description: toErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Text className="font-medium" size="small">
        Repositories
      </Text>
      <GithubRepoList state={repoState} />
      <GithubStarsToggle state={repoState} />
      <div>
        <LoadingButton
          loading={saving}
          onClick={handleSave}
          size="small"
          variant="omi"
        >
          Save selection
        </LoadingButton>
      </div>
    </div>
  );
}

interface GithubRepoPickerState {
  filter: string;
  filtered: GithubRepo[];
  loading: boolean;
  repos: GithubRepo[] | null;
  selectedRepos: Set<string>;
  setFilter: (next: string) => void;
  setStarsEnabled: (next: boolean) => void;
  starsEnabled: boolean;
  toggleRepo: (name: string) => void;
}

function useGithubRepoPicker({
  connectionId,
  initialScope,
}: {
  connectionId: Id<"connection">;
  initialScope: GithubScopeSelection | undefined;
}): GithubRepoPickerState {
  const listRepos = useConvexAction(
    api.connections.providers.github_actions.listMyRepos
  );
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    () => new Set(initialScope?.repos?.map((r) => r.name) ?? [])
  );
  const [starsEnabled, setStarsEnabled] = useState(
    Boolean(initialScope?.starsEnabled)
  );
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    listRepos({ connectionId })
      .then((result) => setRepos(result))
      .catch((err) => {
        toastManager.add({
          type: "error",
          title: "Could not load repositories",
          description: toErrorMessage(err),
        });
        setRepos([]);
      })
      .finally(() => setLoading(false));
  }, [connectionId, listRepos]);

  const filtered = useMemo(() => {
    if (!repos) {
      return [];
    }
    const q = filter.trim().toLowerCase();
    if (!q) {
      return repos;
    }
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, filter]);

  const toggleRepo = (name: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return {
    filter,
    filtered,
    loading,
    repos,
    selectedRepos,
    setFilter,
    starsEnabled,
    setStarsEnabled,
    toggleRepo,
  };
}

function GithubRepoList({ state }: { state: GithubRepoPickerState }) {
  return (
    <div className="-mt-4 flex flex-col gap-1.5">
      <Input
        onChange={(e) => state.setFilter(e.target.value)}
        placeholder="Filter repos…"
        type="search"
        value={state.filter}
      />
      <div className="max-h-72 overflow-y-auto rounded-md border border-ui-border-base">
        {state.loading ? (
          <div className="px-3 py-4">
            <Text className="text-ui-fg-subtle" size="small">
              Loading repositories…
            </Text>
          </div>
        ) : state.filtered.length === 0 ? (
          <div className="px-3 py-4">
            <Text className="text-ui-fg-subtle" size="small">
              {state.repos && state.repos.length === 0
                ? "No admin-eligible repositories found on your account."
                : "No repos match the filter."}
            </Text>
          </div>
        ) : (
          state.filtered.map((r) => (
            <button
              className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left hover:bg-ui-bg-component"
              key={r.fullName}
              onClick={() => state.toggleRepo(r.fullName)}
              type="button"
            >
              <Checkbox
                checked={state.selectedRepos.has(r.fullName)}
                onCheckedChange={() => state.toggleRepo(r.fullName)}
              />
              <div className="min-w-0">
                <Text className="font-medium" size="small">
                  {r.fullName}
                  {r.private ? (
                    <Badge className="ml-2" size="sm" variant="warning">
                      private
                    </Badge>
                  ) : null}
                </Text>
                {r.description ? (
                  <Text className="text-ui-fg-subtle" size="small">
                    {r.description}
                  </Text>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function GithubStarsToggle({ state }: { state: GithubRepoPickerState }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Text className="font-medium" size="small">
          Track new stars
        </Text>
        <Text className="text-ui-fg-subtle" size="small">
          Adds a resource for each repo you star going forward. Existing stars
          are not pulled in.
        </Text>
      </div>
      <Switch
        checked={state.starsEnabled}
        onCheckedChange={(next) => state.setStarsEnabled(Boolean(next))}
      />
    </div>
  );
}

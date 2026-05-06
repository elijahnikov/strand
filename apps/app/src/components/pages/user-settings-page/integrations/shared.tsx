import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@omi/ui/select";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";
import { ConvexError } from "convex/values";
import { CollectionIcon } from "~/components/common/collection-icon";

export type ProviderId = "notion" | "raindrop" | "readwise" | "github";

export interface ConfigConnection {
  _id: Id<"connection">;
  destinationCollectionId?: Id<"collection">;
  lastError?: string;
  lastSyncedAt?: number;
  provider: ProviderId;
  providerAccountLabel?: string;
  scopeSelection?: unknown;
  status: "active" | "expired" | "error" | "paused";
  supportsSync?: boolean;
  syncEnabled?: boolean;
  workspaceId?: Id<"workspace">;
}

export interface WorkspaceOption {
  _id: Id<"workspace">;
  emoji?: string;
  icon?: string;
  iconColor?: string;
  name: string;
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
}

export function WorkspacePicker({
  onChange,
  value,
  workspaces,
}: {
  onChange: (next: Id<"workspace">) => void;
  value: Id<"workspace"> | undefined;
  workspaces: WorkspaceOption[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text className="font-medium" size="small">
        Workspace
      </Text>
      <Select
        onValueChange={(val) => {
          if (typeof val === "string") {
            onChange(val as Id<"workspace">);
          }
        }}
        value={value ?? ""}
      >
        <SelectTrigger>
          <SelectValue>
            {workspaces.find((w) => w._id === value)?.name ??
              "Select workspace"}
          </SelectValue>
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          {workspaces.map((w) => (
            <SelectItem key={w._id} value={w._id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

const ROOT_VALUE = "__root__";

export function DestinationPicker({
  onChange,
  value,
  workspaceId,
}: {
  onChange: (next: Id<"collection"> | undefined) => void;
  value: Id<"collection"> | undefined;
  workspaceId: Id<"workspace"> | undefined;
}) {
  const { data: collections } = useQuery(
    convexQuery(
      api.collection.queries.listAll,
      workspaceId ? { workspaceId } : "skip"
    )
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        disabled={!workspaceId}
        onValueChange={(val) => {
          if (typeof val !== "string") {
            return;
          }
          if (val === ROOT_VALUE) {
            onChange(undefined);
          } else {
            onChange(val as Id<"collection">);
          }
        }}
        value={value ?? ROOT_VALUE}
      >
        <SelectTrigger>
          <SelectValue>
            {(() => {
              const match = value
                ? (collections ?? []).find((c) => c._id === value)
                : undefined;
              return (
                <span className="flex items-center gap-2">
                  {match ? (
                    <CollectionIcon
                      icon={match.icon}
                      iconColor={match.iconColor}
                      size="xs"
                    />
                  ) : null}
                  <span>{match?.name ?? "Workspace root"}</span>
                </span>
              );
            })()}
          </SelectValue>
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          <SelectItem value={ROOT_VALUE}>Workspace root</SelectItem>
          {(collections ?? []).map((c) => (
            <SelectItem key={c._id} value={c._id}>
              <span className="flex items-center gap-2">
                <CollectionIcon
                  icon={c.icon}
                  iconColor={c.iconColor}
                  size="xs"
                />
                <span>{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <Text className="text-ui-fg-muted" size="xsmall">
        Synced items will land here. Defaults to the workspace root.
      </Text>
    </div>
  );
}

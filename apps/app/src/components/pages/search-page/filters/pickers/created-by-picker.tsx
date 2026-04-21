import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { UserAvatar } from "~/components/common/user-avatar";
import { useSearchFilters } from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

export function CreatedByPicker({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const { createdByIds, setCreatedByIds } = useSearchFilters();
  const { data: members } = useQuery(
    convexQuery(api.workspace.queries.listMembers, { workspaceId })
  );

  const items = useMemo(
    () =>
      (members ?? []).map((m) => ({
        id: m.userId as string,
        label: m.username,
        icon: (
          <UserAvatar
            className="size-4 shadow-none"
            image={m.image ?? undefined}
            name={m.username}
            size={16}
          />
        ),
      })),
    [members]
  );

  return (
    <MultiSelectPicker
      emptyMessage="No members."
      items={items}
      onChange={(next) => {
        const typed = next as Id<"user">[];
        setCreatedByIds(typed.length === 0 ? null : typed);
      }}
      searchPlaceholder="Search members…"
      selectedIds={createdByIds}
    />
  );
}

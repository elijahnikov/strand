import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { useQuery } from "@tanstack/react-query";
import { FolderIcon, FolderMinusIcon } from "lucide-react";
import { useMemo } from "react";
import {
  NO_COLLECTION_SENTINEL,
  useSearchFilters,
} from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

export function CollectionPicker({
  workspaceId,
  onClose,
}: {
  workspaceId: Id<"workspace">;
  onClose: () => void;
}) {
  const { collectionId, setCollectionId } = useSearchFilters();
  const { data: collections } = useQuery(
    convexQuery(api.collection.queries.listAll, { workspaceId })
  );

  const items = useMemo(() => {
    const base = [
      {
        id: NO_COLLECTION_SENTINEL,
        label: "No collection",
        icon: <FolderMinusIcon className="size-3.5" />,
      },
    ];
    for (const c of collections ?? []) {
      base.push({
        id: c._id as string,
        label: c.name,
        icon: c.icon ? (
          <span className="text-xs">{c.icon}</span>
        ) : (
          <FolderIcon className="size-3.5" />
        ),
      });
    }
    return base;
  }, [collections]);

  const selectedIds = collectionId ? [collectionId as string] : [];

  return (
    <MultiSelectPicker
      emptyMessage="No collections."
      items={items}
      onChange={(next) => {
        const pick = next.at(-1);
        if (pick) {
          setCollectionId(pick);
        } else {
          setCollectionId(null);
        }
        onClose();
      }}
      searchPlaceholder="Search collections…"
      selectedIds={selectedIds}
    />
  );
}

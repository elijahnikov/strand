import { FileIcon, GlobeIcon, StickyNoteIcon } from "lucide-react";
import { useSearchFilters } from "../../use-search-filters";
import { MultiSelectPicker } from "./multi-select-picker";

const TYPE_ITEMS = [
  { id: "website", label: "Website", icon: <GlobeIcon className="size-3.5" /> },
  { id: "note", label: "Note", icon: <StickyNoteIcon className="size-3.5" /> },
  { id: "file", label: "File", icon: <FileIcon className="size-3.5" /> },
];

const TYPE_IDS = new Set(TYPE_ITEMS.map((i) => i.id));

export function TypePicker() {
  const { types, setTypes } = useSearchFilters();
  return (
    <MultiSelectPicker
      emptyMessage="No types."
      items={TYPE_ITEMS}
      onChange={(next) => {
        const valid = next.filter((v): v is "website" | "note" | "file" =>
          TYPE_IDS.has(v)
        );
        setTypes(valid.length === 0 ? null : valid);
      }}
      searchable={false}
      selectedIds={types ?? []}
    />
  );
}

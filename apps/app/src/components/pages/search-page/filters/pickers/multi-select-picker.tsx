import { Badge } from "@omi/ui/badge";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@omi/ui/command";
import { CheckIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

export interface MultiSelectItem {
  icon?: ReactNode;
  id: string;
  label: string;
  sublabel?: string;
}

export function MultiSelectPicker({
  items,
  selectedIds,
  onChange,
  searchable = true,
  searchPlaceholder = "Search…",
  emptyMessage = "No results.",
}: {
  items: MultiSelectItem[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel?.toLowerCase().includes(q)
    );
  }, [items, query]);

  const toggle = (id: string) => {
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  return (
    <Command
      autoHighlight={false}
      items={[{ value: "items", items: filtered }]}
      keepHighlight={false}
      onValueChange={searchable ? setQuery : undefined}
      value={query}
    >
      <div className="flex w-56 flex-col">
        {searchable ? (
          <div className="px-1 pb-1 [&>div]:px-0! [&>div]:py-0!">
            <CommandInput
              className="txt-compact-small h-7"
              placeholder={searchPlaceholder}
            />
          </div>
        ) : null}
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandList className="max-h-72 overflow-y-auto p-0!">
          {(group: { value: string; items: MultiSelectItem[] }) => (
            <CommandGroup className="p-0" items={group.items}>
              <CommandCollection>
                {(item: MultiSelectItem) => (
                  <CommandItem
                    className="txt-compact-small! flex cursor-pointer items-center gap-x-2 rounded-xl px-2 py-1.5 font-medium! text-ui-fg-subtle data-highlighted:bg-ui-bg-component-hover data-highlighted:text-ui-fg-base"
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    value={item.id}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {selectedSet.has(item.id) ? (
                        <CheckIcon className="size-3.5" />
                      ) : null}
                    </span>
                    {item.icon ? (
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel ? (
                      <Badge className="shrink-0" size="sm" variant="mono">
                        {item.sublabel}
                      </Badge>
                    ) : null}
                  </CommandItem>
                )}
              </CommandCollection>
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </Command>
  );
}

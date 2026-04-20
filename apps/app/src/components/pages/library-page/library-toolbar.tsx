import { RiFilter3Fill } from "@remixicon/react";
import { Button } from "@strand/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { Input } from "@strand/ui/input";
import {
  ArrowDownAZIcon,
  ArrowUpDownIcon,
  ClockIcon,
  FileIcon,
  FolderPlusIcon,
  GlobeIcon,
  StickyNoteIcon,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

const TYPE_VALUES = ["website", "note", "file"] as const;
const ORDER_VALUES = ["newest", "oldest", "alphabetical"] as const;

const TYPE_OPTIONS = [
  { value: null, label: "All types", icon: null },
  { value: "website" as const, label: "Websites", icon: GlobeIcon },
  { value: "note" as const, label: "Notes", icon: StickyNoteIcon },
  { value: "file" as const, label: "Files", icon: FileIcon },
] as const;

const ORDER_OPTIONS = [
  { value: null, label: "Newest", icon: ClockIcon },
  { value: "oldest" as const, label: "Oldest", icon: ClockIcon },
  {
    value: "alphabetical" as const,
    label: "Alphabetical",
    icon: ArrowDownAZIcon,
  },
] as const;

export function useLibraryFilters() {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsStringLiteral(TYPE_VALUES).withOptions({ shallow: false })
  );
  const [order, setOrder] = useQueryState(
    "order",
    parseAsStringLiteral(ORDER_VALUES).withOptions({ shallow: false })
  );

  return { search, setSearch, type, setType, order, setOrder };
}

export function LibraryToolbar({
  onCreateCollection,
}: {
  onCreateCollection?: () => void;
}) {
  const { search, setSearch, type, setType, order, setOrder } =
    useLibraryFilters();

  const _activeTypeLabel =
    TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";
  const _activeOrderLabel =
    ORDER_OPTIONS.find((o) => o.value === order)?.label ?? "Newest";

  return (
    <div className="fixed inset-x-0 top-11 z-30 flex w-full items-center gap-x-2 bg-ui-bg-base! p-2 md:sticky md:inset-x-auto md:top-0 md:rounded-t-lg">
      <Input
        className="w-48 rounded-full bg-ui-bg-base-hover"
        onChange={(e) => setSearch(e.target.value || null)}
        placeholder="Search"
        type="search"
        value={search}
      />
      <div className="ml-auto flex items-center gap-x-2">
        {onCreateCollection && (
          <Button
            className="size-8! shrink-0 rounded-full border-[0.5px]"
            onClick={onCreateCollection}
            variant="secondary"
          >
            <FolderPlusIcon className="size-4 shrink-0" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="size-8 h-8 gap-x-1.5 rounded-full border-[0.5px] px-3 text-xs"
                variant="secondary"
              />
            }
          >
            <RiFilter3Fill className="size-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TYPE_OPTIONS.map((option) => (
              <DropdownMenuItem
                className="[&_svg]:text-ui-fg-subtle hover:[&_svg]:text-ui-fg-base"
                key={option.label}
                onClick={() => setType(option.value)}
              >
                {option.icon && <option.icon className="h-4 w-4" />}
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="size-8! h-8 gap-x-1.5 whitespace-nowrap rounded-full border-[0.5px] px-3 text-xs"
                variant="secondary"
              />
            }
          >
            <ArrowUpDownIcon className="size-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ORDER_OPTIONS.map((option) => (
              <DropdownMenuItem
                className="[&_svg]:text-ui-fg-subtle hover:[&_svg]:text-ui-fg-base"
                key={option.label}
                onClick={() => setOrder(option.value)}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

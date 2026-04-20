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
  LayersIcon,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

const ORDER_VALUES = [
  "newest",
  "oldest",
  "alphabetical",
  "most_resources",
] as const;

const ORDER_OPTIONS = [
  { value: null, label: "Alphabetical", icon: ArrowDownAZIcon },
  { value: "newest" as const, label: "Newest", icon: ClockIcon },
  { value: "oldest" as const, label: "Oldest", icon: ClockIcon },
  {
    value: "most_resources" as const,
    label: "Most resources",
    icon: LayersIcon,
  },
] as const;

export function useTagsFilters() {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );
  const [order, setOrder] = useQueryState(
    "order",
    parseAsStringLiteral(ORDER_VALUES).withOptions({ shallow: false })
  );

  return { search, setSearch, order, setOrder };
}

export function TagsToolbar() {
  const { search, setSearch, order, setOrder } = useTagsFilters();

  const _activeOrderLabel =
    ORDER_OPTIONS.find((o) => o.value === order)?.label ?? "Alphabetical";

  return (
    <div className="fixed inset-x-0 top-11 z-30 flex w-full items-center gap-x-2 bg-ui-bg-base! p-2 md:sticky md:inset-x-auto md:top-0 md:rounded-t-lg">
      <Input
        className="w-48 rounded-full border-[0.5px] bg-ui-bg-base-hover"
        onChange={(e) => setSearch(e.target.value || null)}
        placeholder="Search tags"
        type="search"
        value={search}
      />
      <div className="ml-auto flex items-center gap-x-2">
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

import { cn } from "@strand/ui";
import { CheckIcon } from "lucide-react";
import { useSearchFilters } from "../../use-search-filters";

type BooleanKey = "isPinned" | "isFavorite";

export function BooleanPicker({
  filterKey,
  trueLabel,
  falseLabel,
  onClose,
}: {
  filterKey: BooleanKey;
  trueLabel: string;
  falseLabel: string;
  onClose: () => void;
}) {
  const filters = useSearchFilters();
  const current = filters[filterKey];
  const setter =
    filterKey === "isPinned" ? filters.setIsPinned : filters.setIsFavorite;

  const pick = (value: boolean) => {
    setter(value);
    onClose();
  };

  return (
    <div className="flex w-56 flex-col">
      <Option
        active={current === true}
        label={trueLabel}
        onClick={() => pick(true)}
      />
      <Option
        active={current === false}
        label={falseLabel}
        onClick={() => pick(false)}
      />
    </div>
  );
}

function Option({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "txt-compact-small flex cursor-pointer items-center gap-x-2 rounded-xl px-2 py-1.5 text-left font-medium text-ui-fg-subtle transition-colors hover:bg-ui-bg-component-hover hover:text-ui-fg-base",
        active && "text-ui-fg-base"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {active ? <CheckIcon className="size-3.5" /> : null}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

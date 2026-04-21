import { cn } from "@omi/ui";
import { Checkbox } from "@omi/ui/checkbox";
import type { MouseEvent, ReactNode } from "react";
import {
  type SelectionItem,
  useLibrarySelection,
} from "~/lib/selection/library-selection";

export function SelectableRow({
  item,
  orderedItems,
  children,
}: {
  children: ReactNode;
  item: SelectionItem;
  orderedItems: SelectionItem[];
}) {
  const { count, isSelected, selectRange, toggle, setAnchor } =
    useLibrarySelection();
  const selected = isSelected(item);
  const anySelected = count > 0;

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.shiftKey) {
      event.preventDefault();
    }
  };

  const handleCapturedClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      selectRange(item, orderedItems);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      toggle(item);
      return;
    }
    if (anySelected) {
      event.preventDefault();
      event.stopPropagation();
      toggle(item);
    }
  };

  const handleCheckboxChange = () => {
    toggle(item);
  };

  const handleCheckboxClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (event.shiftKey) {
      event.preventDefault();
      selectRange(item, orderedItems);
      return;
    }
    setAnchor(item);
  };

  return (
    <div
      className={cn(
        "group/selectable relative",
        "[&_.h-8.w-8>*]:transition-opacity",
        "[&_.h-8.w-8]:transition-[background-color,border-color]",
        "hover:[&_.h-8.w-8>*]:opacity-0!",
        "hover:[&_.h-8.w-8]:border-[0.5px]",
        "hover:[&_.h-8.w-8]:bg-ui-bg-subtle",
        "data-[row-selected=true]:[&_.h-8.w-8>*]:opacity-0!",
        "data-[row-selected=true]:[&_.h-8.w-8]:border-[0.5px]",
        "data-[row-selected=true]:[&_.h-8.w-8]:bg-ui-bg-subtle"
      )}
      data-row-selected={selected ? "true" : undefined}
      onClickCapture={handleCapturedClick}
      onMouseDownCapture={handleMouseDown}
    >
      {children}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 z-30 flex size-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150",
          "group-hover/selectable:pointer-events-auto group-hover/selectable:opacity-100",
          "group-data-[row-selected=true]/selectable:pointer-events-auto group-data-[row-selected=true]/selectable:opacity-100"
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
        />
      </div>
    </div>
  );
}

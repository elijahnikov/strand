import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Badge } from "@strand/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@strand/ui/dropdown-menu";
import { CheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  FILTER_CONFIGS,
  FILTER_CONFIGS_BY_ID,
  type FilterConfig,
  type FilterId,
} from "./filter-registry";

export function FilterChip({
  filterId,
  workspaceId,
  creating = false,
  onSwap,
  onCreatingDone,
}: {
  filterId: FilterId;
  workspaceId: Id<"workspace">;
  creating?: boolean;
  onSwap: (to: FilterId) => void;
  onCreatingDone: () => void;
}) {
  const config = FILTER_CONFIGS_BY_ID[filterId];
  return (
    <FilterChipInner
      config={config}
      creating={creating}
      onCreatingDone={onCreatingDone}
      onSwap={onSwap}
      workspaceId={workspaceId}
    />
  );
}

function FilterChipInner({
  config,
  workspaceId,
  creating,
  onSwap,
  onCreatingDone,
}: {
  config: FilterConfig;
  workspaceId: Id<"workspace">;
  creating: boolean;
  onSwap: (to: FilterId) => void;
  onCreatingDone: () => void;
}) {
  const { Icon, Picker, name } = config;
  const chip = config.useChipContent(workspaceId);
  const [valueOpen, setValueOpen] = useState(creating);
  const [nameOpen, setNameOpen] = useState(false);

  useEffect(() => {
    if (creating) {
      setValueOpen(true);
    }
  }, [creating]);

  const operatorLabel =
    chip.operator && chip.operatorLabels[chip.operator]
      ? chip.operatorLabels[chip.operator]
      : null;

  const handleValueOpenChange = (open: boolean) => {
    setValueOpen(open);
    if (!open && creating) {
      onCreatingDone();
    }
  };

  const handleSwap = (otherId: FilterId) => {
    setNameOpen(false);
    chip.clear();
    onSwap(otherId);
  };

  const handleClear = () => {
    chip.clear();
    if (creating) {
      onCreatingDone();
    }
  };

  return (
    <Badge
      className="h-7 gap-x-0 overflow-hidden rounded-full border-[0.5px] bg-ui-bg-base-hover p-0 pr-0.5 pl-0"
      variant="outline"
    >
      <DropdownMenu onOpenChange={setNameOpen} open={nameOpen}>
        <DropdownMenuTrigger className="flex h-full items-center gap-x-1 px-2 text-ui-fg-subtle text-xs transition-colors hover:bg-ui-bg-component hover:text-ui-fg-base">
          <Icon className="size-3 shrink-0" />
          {name}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          {FILTER_CONFIGS.map((other) => {
            const { Icon: OtherIcon, id: otherId, name: otherName } = other;
            const isCurrent = otherId === config.id;
            return (
              <DropdownMenuItem
                key={otherId}
                onClick={() => {
                  if (isCurrent) {
                    setNameOpen(false);
                    return;
                  }
                  handleSwap(otherId);
                }}
              >
                <OtherIcon className="size-3.5! shrink-0 text-ui-fg-muted" />
                <span className="flex-1">{otherName}</span>
                {isCurrent ? (
                  <CheckIcon className="size-3.5! shrink-0 text-ui-fg-muted" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {operatorLabel && chip.operators.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-full items-center border-x-[0.5px] px-2 text-ui-fg-muted text-xs transition-colors hover:bg-ui-bg-component hover:text-ui-fg-base">
            {operatorLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto">
            {chip.operators.map((op) => (
              <DropdownMenuItem
                className="flex items-center gap-x-2"
                key={op}
                onClick={() => chip.setOperator(op)}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {chip.operator === op ? (
                    <CheckIcon className="size-3.5" />
                  ) : null}
                </span>
                <span className="flex-1">{chip.operatorLabels[op] ?? op}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="flex h-full items-center border-x-[0.5px] px-2 text-ui-fg-muted text-xs">
          {operatorLabel ?? "\u00a0"}
        </span>
      )}
      <DropdownMenu onOpenChange={handleValueOpenChange} open={valueOpen}>
        <DropdownMenuTrigger className="flex h-full items-center px-2 text-ui-fg-base text-xs transition-colors hover:bg-ui-bg-component">
          <span className="max-w-[180px] truncate">
            {chip.valueLabel || "…"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto">
          <Picker
            onClose={() => handleValueOpenChange(false)}
            workspaceId={workspaceId}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        aria-label={`Remove ${name} filter`}
        className="mx-1 flex size-4 items-center justify-center rounded-full text-ui-fg-muted hover:bg-ui-bg-component hover:text-ui-fg-base"
        onClick={handleClear}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </Badge>
  );
}

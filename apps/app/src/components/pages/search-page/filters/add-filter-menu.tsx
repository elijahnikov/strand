import { RiFilter3Fill } from "@remixicon/react";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@omi/ui/dropdown-menu";
import { useState } from "react";
import { FILTER_CONFIGS } from "./filter-registry";

export function AddFilterMenu({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            className="size-8 h-8 gap-x-1.5 rounded-full border-[0.5px] px-3 text-xs"
            size="small"
            variant="secondary"
          >
            <RiFilter3Fill className="size-3.5 shrink-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-48">
        {FILTER_CONFIGS.map((config) => {
          const { Icon, Picker, id, name } = config;
          return (
            <DropdownMenuSub key={id}>
              <DropdownMenuSubTrigger>
                <Icon className="size-3.5! shrink-0 text-ui-fg-muted" />
                <span className="flex-1">{name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-auto">
                <Picker onClose={close} workspaceId={workspaceId} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

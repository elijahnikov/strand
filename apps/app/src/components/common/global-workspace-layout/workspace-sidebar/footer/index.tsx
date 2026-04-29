import { SidebarFooter } from "@omi/ui/sidebar";
import { TooltipProvider } from "@omi/ui/tooltip";
import {
  RiDeleteBin2Fill,
  RiQuestionFill,
  RiSettings4Fill,
} from "@remixicon/react";
import { useParams } from "@tanstack/react-router";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { getNavShortcutByTitle } from "~/lib/hotkeys/registry";

export default function WorkspaceSidebarFooter() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  return (
    <SidebarFooter className="relative bottom-2 px-2">
      <TooltipProvider>
        <div className="flex w-full flex-col gap-1">
          {params?.workspaceId && (
            <SidebarLinkItem
              icon={RiDeleteBin2Fill}
              shortcut={getNavShortcutByTitle("Trash")}
              title="Trash"
              url={`/workspace/${params.workspaceId}/trash`}
            />
          )}
          {params?.workspaceId && (
            <SidebarLinkItem
              icon={RiSettings4Fill}
              shortcut={getNavShortcutByTitle("Settings")}
              title="Settings"
              url={`/workspace/${params.workspaceId}/settings`}
            />
          )}
          <SidebarLinkItem
            external
            icon={RiQuestionFill}
            title="Help"
            url="https://docs.omi.co"
          />
        </div>
      </TooltipProvider>
    </SidebarFooter>
  );
}

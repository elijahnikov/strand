import { cn } from "@omi/ui";
import { SidebarFooter } from "@omi/ui/sidebar";
import { TooltipProvider } from "@omi/ui/tooltip";
import {
  RiDeleteBin2Fill,
  RiQuestionFill,
  RiSettings4Fill,
} from "@remixicon/react";
import { useLocation, useParams } from "@tanstack/react-router";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { getNavShortcutByTitle } from "~/lib/hotkeys/registry";
import { useSidebarStore } from "~/lib/sidebar-store";

export default function WorkspaceSidebarFooter() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (location) => location.pathname });
  const workspacePath = `/workspace/${params.workspaceId}`;
  const sidebarOpen = useSidebarStore((s) => s.open);

  return (
    <SidebarFooter
      className={cn(
        sidebarOpen ? "px-2" : "pl-2",
        "relative bottom-2 w-full! pr-0"
      )}
    >
      <TooltipProvider>
        <div className="flex w-full flex-col gap-1">
          {params?.workspaceId && (
            <SidebarLinkItem
              icon={RiDeleteBin2Fill}
              isActive={pathname === `${workspacePath}/trash`}
              shortcut={getNavShortcutByTitle("Trash")}
              sidebarOpen={sidebarOpen}
              title="Trash"
              url={`/workspace/${params.workspaceId}/trash`}
            />
          )}
          {params?.workspaceId && (
            <SidebarLinkItem
              icon={RiSettings4Fill}
              isActive={pathname === `${workspacePath}/settings`}
              shortcut={getNavShortcutByTitle("Settings")}
              sidebarOpen={sidebarOpen}
              title="Settings"
              url={`/workspace/${params.workspaceId}/settings`}
            />
          )}
          <SidebarLinkItem
            external
            icon={RiQuestionFill}
            sidebarOpen={sidebarOpen}
            title="Help"
            url="https://docs.omi.co"
          />
        </div>
      </TooltipProvider>
    </SidebarFooter>
  );
}

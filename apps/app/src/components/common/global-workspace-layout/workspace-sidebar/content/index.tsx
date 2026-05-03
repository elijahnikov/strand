import { cn } from "@omi/ui";
import { SidebarContent } from "@omi/ui/sidebar";
import { TooltipProvider } from "@omi/ui/tooltip";
import {
  RiBookletFill,
  RiBookmarkFill,
  RiChat1Fill,
  RiHashtag,
  RiHome3Fill,
  RiSearch2Fill,
} from "@remixicon/react";
import { useLocation, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { getNavShortcutByTitle } from "~/lib/hotkeys/registry";
import { useSidebarStore } from "~/lib/sidebar-store";

export default function WorkspaceSidebarContent() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (location) => location.pathname });
  const sidebarOpen = useSidebarStore((s) => s.open);

  const navigationItems = useMemo(() => {
    if (!params?.workspaceId) {
      return [];
    }

    const workspacePath = `/workspace/${params.workspaceId}`;

    return [
      {
        icon: RiHome3Fill,
        title: "Home",
        url: `/workspace/${params.workspaceId}`,
        isActive: pathname === workspacePath,
      },
      {
        icon: RiBookmarkFill,
        title: "Library",
        url: `/workspace/${params.workspaceId}/library`,
        isActive: pathname === `${workspacePath}/library`,
      },
      {
        icon: RiSearch2Fill,
        title: "Search",
        url: `/workspace/${params.workspaceId}/search`,
        isActive: pathname === `${workspacePath}/search`,
      },
      {
        icon: RiChat1Fill,
        title: "Chat",
        url: `/workspace/${params.workspaceId}/chat`,
        isActive: pathname.startsWith(`${workspacePath}/chat`),
      },
      {
        icon: RiHashtag,
        title: "Tags",
        url: `/workspace/${params.workspaceId}/tags`,
        isActive:
          pathname === `${workspacePath}/tags` ||
          pathname.includes(`${workspacePath}/tags`),
      },
      {
        icon: RiBookletFill,
        title: "Journal",
        url: `/workspace/${params.workspaceId}/journal`,
        isActive: pathname.startsWith(`${workspacePath}/journal`),
      },
    ];
  }, [pathname, params?.workspaceId]);

  return (
    <SidebarContent className={cn(sidebarOpen ? "px-2" : "pl-2", "w-full")}>
      <TooltipProvider>
        <div className="flex w-full flex-col gap-1">
          {navigationItems.map((item) => (
            <SidebarLinkItem
              icon={item.icon}
              isActive={item.isActive}
              key={item.title}
              shortcut={getNavShortcutByTitle(item.title)}
              sidebarOpen={sidebarOpen}
              title={item.title}
              url={item.url}
            />
          ))}
        </div>
      </TooltipProvider>
    </SidebarContent>
  );
}

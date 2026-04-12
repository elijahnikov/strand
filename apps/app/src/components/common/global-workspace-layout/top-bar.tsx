import {
  RiBookmarkFill,
  RiChat1Fill,
  RiHashtag,
  RiHome3Fill,
  RiSearch2Fill,
} from "@remixicon/react";
import { TooltipProvider } from "@strand/ui/tooltip";
import { useLocation, useParams } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";
import { WorkspaceSwitcher } from "~/components/common/global-workspace-layout/workspace-sidebar/header/workspace-switcher";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { WorkspacePresenceAvatars } from "~/components/common/workspace-presence";

export function TopBar() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (location) => location.pathname });

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
    ];
  }, [pathname, params?.workspaceId]);
  return (
    <div className="pointer-events-none fixed right-1.75 left-1.75 z-100 -mb-2 flex h-11 items-center justify-between bg-ui-bg-base px-1 md:absolute md:bg-transparent">
      <div className="pointer-events-auto flex items-center gap-x-2">
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
        <WorkspaceSwitcher />
        <div className="flex items-center gap-x-1">
          <TooltipProvider>
            {navigationItems.map((item) => (
              <SidebarLinkItem
                icon={item.icon}
                isActive={item.isActive}
                key={item.title}
                title={item.title}
                url={item.url}
              />
            ))}
          </TooltipProvider>
        </div>
      </div>
      <div className="pointer-events-auto">
        <WorkspacePresenceAvatars />
      </div>
    </div>
  );
}

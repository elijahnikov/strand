import {
  RiBookmarkFill,
  RiChat1Fill,
  RiHashtag,
  RiHome3Fill,
  RiSearch2Fill,
} from "@remixicon/react";
import { Separator } from "@strand/ui/separator";
import { TooltipProvider } from "@strand/ui/tooltip";
import { useLocation, useParams } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { TabStrip } from "~/components/common/global-workspace-layout/top-bar/tab-strip";
import { useRouteTabsSync } from "~/components/common/global-workspace-layout/top-bar/use-route-tabs-sync";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";
import { WorkspaceSwitcher } from "~/components/common/global-workspace-layout/workspace-sidebar/header/workspace-switcher";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { WorkspacePresenceAvatars } from "~/components/common/workspace-presence";

export function TopBar() {
  useRouteTabsSync();

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
        url: workspacePath,
        isActive: pathname === workspacePath,
      },
      {
        icon: RiBookmarkFill,
        title: "Library",
        url: `${workspacePath}/library`,
        isActive: pathname === `${workspacePath}/library`,
      },
      {
        icon: RiSearch2Fill,
        title: "Search",
        url: `${workspacePath}/search`,
        isActive: pathname === `${workspacePath}/search`,
      },
      {
        icon: RiChat1Fill,
        title: "Chat",
        url: `${workspacePath}/chat`,
        isActive: pathname === `${workspacePath}/chat`,
      },
      {
        icon: RiHashtag,
        title: "Tags",
        url: `${workspacePath}/tags`,
        isActive: pathname === `${workspacePath}/tags`,
      },
    ];
  }, [pathname, params?.workspaceId]);

  if (!params.workspaceId) {
    return null;
  }

  return (
    <div className="absolute top-0 right-0 left-0 z-[60] flex h-11 items-end bg-ui-bg-subtle px-2">
      <div className="relative z-[3] mb-1.25 flex shrink-0 items-center gap-x-2 pr-3 pb-[3px]">
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
        <Separator className={"h-5"} orientation="vertical" />
      </div>
      <TabStrip workspaceId={params.workspaceId} />
      <div className="relative z-[3] flex shrink-0 items-center pb-[3px] pl-2">
        <WorkspacePresenceAvatars />
      </div>
    </div>
  );
}

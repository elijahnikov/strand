import { RiQuestionFill, RiSettings4Fill } from "@remixicon/react";
import { SidebarFooter } from "@strand/ui/sidebar";
import { TooltipProvider } from "@strand/ui/tooltip";
import { useParams } from "@tanstack/react-router";
import { Suspense } from "react";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";
import SidebarLinkItem from "~/components/common/global-workspace-layout/workspace-sidebar/sidebar-link-item";
import { NotificationsPopover } from "~/components/common/notifications-popover";

export default function WorkspaceSidebarFooter() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  return (
    <SidebarFooter className="relative bottom-2">
      <TooltipProvider>
        <div className="relative left-2px flex flex-col gap-2">
          {params?.workspaceId && (
            <SidebarLinkItem
              icon={RiSettings4Fill}
              title="Settings"
              url={`/workspace/${params.workspaceId}/settings`}
            />
          )}
          <SidebarLinkItem
            external
            icon={RiQuestionFill}
            title="Help & Feedback"
            url="https://github.com/your-repo/strand/issues"
          />
        </div>
        <Suspense>
          <NotificationsPopover />
        </Suspense>
      </TooltipProvider>
      <div className="flex items-center gap-1">
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </SidebarFooter>
  );
}

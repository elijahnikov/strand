import { SidebarHeader } from "@omi/ui/sidebar";
import { Suspense } from "react";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";
import { NotificationsPopover } from "~/components/common/notifications-popover";

export default function WorkspaceSidebarHeader() {
  return (
    <SidebarHeader className="px-2">
      <div className="flex w-full items-center gap-1">
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
        <Suspense>
          <NotificationsPopover />
        </Suspense>
      </div>
    </SidebarHeader>
  );
}

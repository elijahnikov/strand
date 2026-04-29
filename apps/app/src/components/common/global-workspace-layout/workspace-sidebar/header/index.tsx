import { SidebarHeader, SidebarTrigger } from "@omi/ui/sidebar";
import { Suspense } from "react";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";
import { NotificationsPopover } from "~/components/common/notifications-popover";

export default function WorkspaceSidebarHeader() {
  return (
    <SidebarHeader className="px-2 transition-[padding] duration-300 ease-linear group-data-[collapsible=icon]:px-1">
      <div className="flex w-full items-center gap-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap transition-[opacity,filter] duration-200 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:blur-[4px]">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
          <Suspense>
            <NotificationsPopover />
          </Suspense>
        </div>
        <SidebarTrigger className="ml-auto size-7 shrink-0 text-ui-fg-muted transition-colors duration-200 hover:text-ui-fg-base" />
      </div>
    </SidebarHeader>
  );
}

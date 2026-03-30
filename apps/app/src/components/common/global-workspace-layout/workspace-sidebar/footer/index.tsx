import { SidebarFooter } from "@strand/ui/sidebar";
import { Suspense } from "react";
import {
  UserMenu,
  UserMenuSkeleton,
} from "~/components/common/global-workspace-layout/workspace-sidebar/footer/user-menu";

export default function WorkspaceSidebarFooter() {
  return (
    <SidebarFooter className="relative bottom-2">
      <Suspense fallback={<UserMenuSkeleton />}>
        <UserMenu />
      </Suspense>
    </SidebarFooter>
  );
}

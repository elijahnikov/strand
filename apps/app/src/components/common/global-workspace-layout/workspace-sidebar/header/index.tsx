import { SidebarHeader } from "@strand/ui/sidebar";
import { Suspense } from "react";

export default function WorkspaceSidebarHeader() {
  return (
    <SidebarHeader>
      <div className="flex flex-col items-center gap-2">
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
        <Suspense fallback={<WorkspaceSwitcherSkeleton />}>
          <WorkspaceSwitcher />
        </Suspense>
      </div>
    </SidebarHeader>
  );
}

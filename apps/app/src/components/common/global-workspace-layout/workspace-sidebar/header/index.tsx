import { SidebarHeader } from "@strand/ui/sidebar";
import { Suspense } from "react";
import {
  WorkspaceSwitcher,
  WorkspaceSwitcherSkeleton,
} from "./workspace-switcher";

export default function WorkspaceSidebarHeader() {
  return (
    <SidebarHeader>
      <div className="flex flex-col gap-2">
        <Suspense fallback={<WorkspaceSwitcherSkeleton />}>
          <WorkspaceSwitcher />
        </Suspense>
      </div>
    </SidebarHeader>
  );
}

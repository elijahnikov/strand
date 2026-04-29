import { cn } from "@omi/ui";
import { Sidebar } from "@omi/ui/sidebar";
import { TooltipProvider } from "@omi/ui/tooltip";
import WorkspaceSidebarContent from "~/components/common/global-workspace-layout/workspace-sidebar/content";
import WorkspaceSidebarFooter from "~/components/common/global-workspace-layout/workspace-sidebar/footer";
import WorkspaceSidebarHeader from "~/components/common/global-workspace-layout/workspace-sidebar/header";
import { useSidebarStore } from "~/lib/sidebar-store";

export default function MainSidebar() {
  const sidebarOpen = useSidebarStore((s) => s.open);

  return (
    <TooltipProvider>
      <Sidebar
        className={cn(sidebarOpen ? "pl-[4px]" : "pl-1", "z-50 -mt-0.5")}
        collapsible="icon"
        variant="inset"
      >
        <WorkspaceSidebarHeader />
        <WorkspaceSidebarContent />
        <WorkspaceSidebarFooter />
      </Sidebar>
    </TooltipProvider>
  );
}

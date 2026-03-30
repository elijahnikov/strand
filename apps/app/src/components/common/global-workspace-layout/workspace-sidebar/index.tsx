import { Sidebar } from "@strand/ui/sidebar";
import { TooltipProvider } from "@strand/ui/tooltip";
import WorkspaceSidebarHeader from "~/components/common/global-workspace-layout/workspace-sidebar/header";

export default function MainSidebar() {
  return (
    <TooltipProvider>
      <Sidebar className="z-50 -mt-0.5" collapsible="icon" variant="inset">
        <WorkspaceSidebarHeader />
        {/* <MainSidebarContent /> */}
        {/* <MainSidebarFooter /> */}
      </Sidebar>
    </TooltipProvider>
  );
}

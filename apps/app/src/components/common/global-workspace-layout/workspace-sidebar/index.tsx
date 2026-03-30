import { Sidebar } from "@strand/ui/sidebar";
import { TooltipProvider } from "@strand/ui/tooltip";
import WorkspaceSidebarContent from "~/components/common/global-workspace-layout/workspace-sidebar/content";
import WorkspaceSidebarFooter from "~/components/common/global-workspace-layout/workspace-sidebar/footer";
import WorkspaceSidebarHeader from "~/components/common/global-workspace-layout/workspace-sidebar/header";

export default function MainSidebar() {
  return (
    <TooltipProvider>
      <Sidebar
        className="z-50 -mt-0.5 px-0 pl-px"
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

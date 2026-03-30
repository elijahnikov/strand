import { SidebarInset, SidebarProvider } from "@strand/ui/sidebar";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import MainSidebar from "~/components/common/global-workspace-layout/workspace-sidebar";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-ui-bg-base" defaultOpen={true} open={true}>
      <MainSidebar />
      <SidebarInset className="mt-auto">
        <main className="h-full flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
      <TopBar />
    </SidebarProvider>
  );
}

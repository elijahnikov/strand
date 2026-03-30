import { SidebarInset, SidebarProvider } from "@strand/ui/sidebar";
import MainSidebar from "~/components/common/global-workspace-layout/workspace-sidebar";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className="h-full bg-ui-bg-subtle"
      defaultOpen={true}
      open={true}
    >
      <MainSidebar />
      <SidebarInset>
        <main className="h-full overflow-y-auto md:max-h-[calc(100vh-18px)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

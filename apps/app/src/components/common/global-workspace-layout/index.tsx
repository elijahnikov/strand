import { cn } from "@strand/ui";
import { SidebarInset, SidebarProvider } from "@strand/ui/sidebar";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import MainSidebar from "~/components/common/global-workspace-layout/workspace-sidebar";
import { FileDropProvider, useFileDrop } from "~/hooks/use-file-drop";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  return (
    <FileDropProvider>
      <SidebarProvider
        className="bg-ui-bg-subtle!"
        defaultOpen={true}
        open={true}
      >
        <MainSidebar />
        <DropZoneInset>{children}</DropZoneInset>
        <TopBar />
      </SidebarProvider>
    </FileDropProvider>
  );
}

function DropZoneInset({ children }: { children: React.ReactNode }) {
  const { isDragging } = useFileDrop();

  return (
    <SidebarInset
      className={cn(
        "mt-auto shadow-borders-base-light transition-[background-color,box-shadow] duration-200",
        isDragging &&
          "z-40! bg-blue-50 ring-2 ring-blue-400 ring-inset dark:bg-blue-950/30 dark:ring-blue-500"
      )}
    >
      <main className="h-full flex-1 overflow-y-auto">{children}</main>
    </SidebarInset>
  );
}

import { SidebarInset, SidebarProvider } from "@strand/ui/sidebar";
import { useParams } from "@tanstack/react-router";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import MainSidebar from "~/components/common/global-workspace-layout/workspace-sidebar";
import { WorkspacePresenceProvider } from "~/components/common/workspace-presence";
import { FileDropProvider, useFileDrop } from "~/hooks/use-file-drop";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  const content = (
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

  if (workspaceId) {
    return (
      <WorkspacePresenceProvider workspaceId={workspaceId}>
        {content}
      </WorkspacePresenceProvider>
    );
  }

  return content;
}

function DropZoneInset({ children }: { children: React.ReactNode }) {
  const { isDragging } = useFileDrop();

  return (
    <SidebarInset className="relative mt-auto shadow-borders-base-light transition-[background-color,box-shadow] duration-200">
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 rounded-[inherit] bg-blue-50 ring-2 ring-blue-400 ring-inset dark:bg-blue-950/30 dark:ring-blue-500" />
      )}
      <main className="h-full flex-1 overflow-y-auto">{children}</main>
    </SidebarInset>
  );
}

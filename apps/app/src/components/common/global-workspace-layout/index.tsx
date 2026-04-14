import type { Id } from "@strand/backend/_generated/dataModel.js";
import { SidebarInset, SidebarProvider } from "@strand/ui/sidebar";
import { useParams } from "@tanstack/react-router";
import { CommandPaletteProvider } from "~/components/common/command-palette/use-command-palette";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import { WorkspacePresenceProvider } from "~/components/common/workspace-presence";
import { FileDropProvider, useFileDrop } from "~/hooks/use-file-drop";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  const content = (
    <FileDropProvider>
      <SidebarProvider
        className="relative bg-ui-bg-subtle!"
        defaultOpen={true}
        open={true}
      >
        <TopBar />
        <DropZoneInset>{children}</DropZoneInset>
      </SidebarProvider>
    </FileDropProvider>
  );

  if (workspaceId) {
    return (
      <WorkspacePresenceProvider workspaceId={workspaceId}>
        <CommandPaletteProvider workspaceId={workspaceId as Id<"workspace">}>
          {content}
        </CommandPaletteProvider>
      </WorkspacePresenceProvider>
    );
  }

  return content;
}

function DropZoneInset({ children }: { children: React.ReactNode }) {
  const { isDragging } = useFileDrop();

  return (
    <SidebarInset className="relative mx-2 rounded-t-2xl border-[0.5px] transition-[background-color,box-shadow] duration-200">
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 rounded-[inherit] bg-blue-50 ring-2 ring-blue-400 ring-inset dark:bg-blue-950/30 dark:ring-blue-500" />
      )}
      <main className="h-full flex-1 overflow-y-auto pt-11 md:pt-0">
        {children}
      </main>
    </SidebarInset>
  );
}

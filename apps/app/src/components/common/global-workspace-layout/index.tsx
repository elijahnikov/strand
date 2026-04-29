import type { Id } from "@omi/backend/_generated/dataModel.js";
import { SidebarInset, SidebarProvider } from "@omi/ui/sidebar";
import {
  CatchBoundary,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CommandPaletteProvider } from "~/components/common/command-palette/use-command-palette";
import { DevCrashTrigger } from "~/components/common/dev-crash-trigger";
import { ErrorState } from "~/components/common/error-state";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import { useGlobalHotkeys } from "~/components/common/global-workspace-layout/use-global-hotkeys";
import MainSidebar from "~/components/common/global-workspace-layout/workspace-sidebar";
import { ImportProgressToast } from "~/components/common/import-progress-toast";
import { ShortcutsHelpProvider } from "~/components/common/shortcuts-help";
import { WorkspacePresenceProvider } from "~/components/common/workspace-presence";
import { FileDropProvider, useFileDrop } from "~/hooks/use-file-drop";
import { useSidebarStore } from "~/lib/sidebar-store";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const sidebarOpen = useSidebarStore((s) => s.open);
  const setSidebarOpen = useSidebarStore((s) => s.setOpen);
  const transitionsEnabled = useTransitionsEnabledAfterMount();

  const content = (
    <FileDropProvider>
      <SidebarProvider
        className={
          transitionsEnabled
            ? "relative bg-ui-bg-subtle!"
            : "[&_*]:!transition-none relative bg-ui-bg-subtle!"
        }
        defaultOpen={sidebarOpen}
        onOpenChange={setSidebarOpen}
        open={sidebarOpen}
      >
        <MainSidebar />
        <TopBar />
        <DropZoneInset>{children}</DropZoneInset>
      </SidebarProvider>
    </FileDropProvider>
  );

  if (workspaceId) {
    return (
      <WorkspacePresenceProvider workspaceId={workspaceId}>
        <CommandPaletteProvider workspaceId={workspaceId as Id<"workspace">}>
          <ShortcutsHelpProvider>
            <GlobalHotkeys workspaceId={workspaceId as Id<"workspace">} />
            {content}
            <ImportProgressToast workspaceId={workspaceId as Id<"workspace">} />
          </ShortcutsHelpProvider>
        </CommandPaletteProvider>
      </WorkspacePresenceProvider>
    );
  }

  return content;
}

function GlobalHotkeys({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  useGlobalHotkeys({ workspaceId });
  return null;
}

function DropZoneInset({ children }: { children: React.ReactNode }) {
  const { isDragging } = useFileDrop();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainRef = useRef<HTMLElement>(null);

  useScrollRestoration(mainRef, pathname);

  return (
    <SidebarInset className="relative mx-2 mt-1 rounded-t-2xl border-[0.5px] transition-[background-color,box-shadow] duration-200 md:h-[calc(100vh-48px)]">
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 rounded-[inherit] bg-blue-50 ring-2 ring-blue-400 ring-inset dark:bg-blue-950/30 dark:ring-blue-500" />
      )}
      <main
        className="h-full flex-1 overflow-y-auto pt-11 md:pt-0"
        ref={mainRef}
      >
        <CatchBoundary errorComponent={ErrorState} getResetKey={() => pathname}>
          <DevCrashTrigger scope="page" />
          {children}
        </CatchBoundary>
      </main>
    </SidebarInset>
  );
}

function useTransitionsEnabledAfterMount() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnabled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return enabled;
}

function useScrollRestoration(
  ref: React.RefObject<HTMLElement | null>,
  pathname: string
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.scrollTop = 0;
  }, [ref, pathname]);
}

import type { Id } from "@omi/backend/_generated/dataModel.js";
import { SidebarInset, SidebarProvider } from "@omi/ui/sidebar";
import {
  CatchBoundary,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { CommandPaletteProvider } from "~/components/common/command-palette/use-command-palette";
import { DevCrashTrigger } from "~/components/common/dev-crash-trigger";
import { ErrorState } from "~/components/common/error-state";
import { TopBar } from "~/components/common/global-workspace-layout/top-bar";
import { useGlobalHotkeys } from "~/components/common/global-workspace-layout/use-global-hotkeys";
import { ImportProgressToast } from "~/components/common/import-progress-toast";
import { ShortcutsHelpProvider } from "~/components/common/shortcuts-help";
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
    <SidebarInset className="relative mx-2 rounded-t-2xl border-[0.5px] transition-[background-color,box-shadow] duration-200">
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

function useScrollRestoration(
  ref: React.RefObject<HTMLElement | null>,
  pathname: string
) {
  // Reset the inner scroll container to the top whenever the route changes.
  // The shared <main> persists across navigations, so without this the
  // outgoing route's scrollTop carries over into the incoming route.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.scrollTop = 0;
  }, [ref, pathname]);
}

import { useSidebar } from "@omi/ui/sidebar";
import { useParams } from "@tanstack/react-router";
import { TabStrip } from "~/components/common/global-workspace-layout/top-bar/tab-strip";
import { useRouteTabsSync } from "~/components/common/global-workspace-layout/top-bar/use-route-tabs-sync";

export function TopBar() {
  useRouteTabsSync();

  const { state } = useSidebar();
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  if (!params.workspaceId) {
    return null;
  }

  const leftClass =
    state === "collapsed" ? "left-12" : "left-[var(--sidebar-width)]";

  return (
    <>
      <div
        className={`absolute top-0 right-0 z-[40] flex h-10 items-end bg-ui-bg-subtle px-2 transition-[left] duration-300 ease-linear ${leftClass}`}
      >
        <TabStrip workspaceId={params.workspaceId} />
      </div>
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0 z-[45] h-10 w-8 bg-linear-to-r from-50% from-ui-bg-subtle to-transparent transition-[left] duration-300 ease-linear ${leftClass}`}
      />
    </>
  );
}

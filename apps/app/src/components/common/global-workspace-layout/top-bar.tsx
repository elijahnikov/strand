import { useParams } from "@tanstack/react-router";
import { TabStrip } from "~/components/common/global-workspace-layout/top-bar/tab-strip";
import { useRouteTabsSync } from "~/components/common/global-workspace-layout/top-bar/use-route-tabs-sync";

export function TopBar() {
  useRouteTabsSync();

  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };

  if (!params.workspaceId) {
    return null;
  }

  return (
    <>
      <div className="absolute top-0 right-0 left-[12rem] z-[40] flex h-11 items-end bg-ui-bg-subtle px-2">
        <TabStrip workspaceId={params.workspaceId} />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-[12rem] z-[45] h-11 w-8 bg-linear-to-r from-50% from-ui-bg-subtle to-transparent"
      />
    </>
  );
}

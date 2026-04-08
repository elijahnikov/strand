import { Separator } from "@strand/ui/separator";
import { WorkspaceSwitcher } from "~/components/common/global-workspace-layout/workspace-sidebar/header/workspace-switcher";
import { WorkspacePresenceAvatars } from "~/components/common/workspace-presence";
import { Breadcrumbs } from "./breadcrumbs";

export function TopBar() {
  return (
    <div className="pointer-events-none absolute top-1 right-1.75 left-1.75 z-50 m-1 flex items-center justify-between">
      <div className="pointer-events-auto flex items-center">
        <img
          alt="Strand"
          className="hidden rounded-lg dark:block"
          height={36}
          src="/STRAND_TRANSPARENT_WHITE.png"
          width={36}
        />
        <img
          alt="Strand"
          className="rounded-lg dark:hidden"
          height={36}
          src="/STRAND_TRANSPARENT_BLACK.png"
          width={36}
        />
        <Separator
          className="my-3 mr-3 ml-2 rotate-30"
          orientation="vertical"
        />
        <WorkspaceSwitcher />
        <Breadcrumbs />
      </div>
      <div className="pointer-events-auto">
        <WorkspacePresenceAvatars />
      </div>
    </div>
  );
}

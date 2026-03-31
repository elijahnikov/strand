import { Separator } from "@strand/ui/separator";
import { useLocation, useParams } from "@tanstack/react-router";
import { WorkspaceSwitcher } from "~/components/common/global-workspace-layout/workspace-sidebar/header/workspace-switcher";

const pageLabels: Record<string, string> = {
  library: "Library",
  search: "Search",
  settings: "Settings",
};

export function TopBar() {
  const params = useParams({ strict: false }) as {
    workspaceId?: string;
  };
  const pathname = useLocation({ select: (l) => l.pathname });

  const segments = params?.workspaceId
    ? (pathname
        .split(`/workspace/${params.workspaceId}`)[1]
        ?.split("/")
        .filter(Boolean) ?? [])
    : [];

  const currentPage = segments[0];

  return (
    <div className="absolute top-1 left-1.75 z-50 m-1 flex items-center justify-start">
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
      <Separator className="my-3 mr-3 ml-2 rotate-30" orientation="vertical" />
      <WorkspaceSwitcher />
      {params?.workspaceId && currentPage && (
        <>
          <Separator
            className="my-3 mr-3 ml-2 rotate-30"
            orientation="vertical"
          />
          <span className="txt-small font-medium text-ui-fg-base">
            {pageLabels[currentPage] ?? currentPage}
          </span>
        </>
      )}
    </div>
  );
}

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ShareFileResource } from "./share-file-resource";
import { ShareNoteResource } from "./share-note-resource";
import { ShareWebsiteResource } from "./share-website-resource";

export function SharePage() {
  const { slug } = useParams({ from: "/share/$slug" });
  const { data, isLoading } = useQuery(
    convexQuery(api.resourceShare.queries.getPublicBySlug, { slug })
  );

  if (isLoading) {
    return null;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <Text className="font-medium" size="large">
          This page isn't shared.
        </Text>
        <Text className="text-ui-fg-subtle" size="small">
          The link may have been revoked or never existed.
        </Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ui-bg-base">
      <div className="mx-auto h-full px-3 pt-8">
        {data.type === "website" && <ShareWebsiteResource resource={data} />}
        {data.type === "note" && <ShareNoteResource resource={data} />}
        {data.type === "file" && <ShareFileResource resource={data} />}
      </div>
      <div className="mx-auto w-full pb-6">
        <div className="mt-16 flex items-center justify-center border-t-[0.5px] pt-6">
          <img
            alt="omi"
            className="hidden rounded-lg dark:block"
            height={32}
            src="/omi_white_on_transparent.png"
            width={32}
          />
          <img
            alt="omi"
            className="rounded-lg dark:hidden"
            height={32}
            src="/omi_black_on_transparent.png"
            width={32}
          />
          <Text className="font-medium text-ui-fg-subtle" size="xsmall">
            Shared from{" "}
            <Link
              className="text-ui-fg-base underline-offset-2 hover:underline"
              to="/register"
            >
              Omi
            </Link>
          </Text>
        </div>
      </div>
    </div>
  );
}

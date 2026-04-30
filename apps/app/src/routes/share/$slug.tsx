import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { createFileRoute } from "@tanstack/react-router";
import { SharePage } from "~/components/pages/share-page";

export const Route = createFileRoute("/share/$slug")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.resourceShare.queries.getPublicBySlug, {
        slug: params.slug,
      })
    );
  },
  head: ({ loaderData: _loaderData, params }) => ({
    meta: [{ title: `Shared resource · ${params.slug}` }],
  }),
  component: SharePage,
});

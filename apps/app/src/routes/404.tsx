import { createFileRoute } from "@tanstack/react-router";
import { NotFoundState } from "~/components/common/not-found-state";

export const Route = createFileRoute("/404")({
  component: NotFoundState,
});

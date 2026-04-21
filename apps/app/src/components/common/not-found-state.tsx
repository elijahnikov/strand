import { RiCompassFill } from "@remixicon/react";
import { Button } from "@omi/ui/button";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "./empty-state";

export function NotFoundState({
  title = "Page not found",
  description = "The page you're looking for doesn't exist or has been moved.",
  homeTo = "/",
  homeLabel = "Go home",
}: {
  title?: string;
  description?: string;
  homeTo?: string;
  homeLabel?: string;
}) {
  return (
    <EmptyState
      action={
        <Link to={homeTo}>
          <Button variant="omi">{homeLabel}</Button>
        </Link>
      }
      description={description}
      Icon={RiCompassFill}
      title={title}
    />
  );
}

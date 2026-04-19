import { RiErrorWarningFill } from "@remixicon/react";
import { Button } from "@strand/ui/button";
import { useRouter } from "@tanstack/react-router";
import { EmptyState } from "./empty-state";

export function ErrorState({
  error,
  reset,
}: {
  error: unknown;
  reset?: () => void;
}) {
  const router = useRouter();
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";

  const handleRetry = () => {
    if (reset) {
      reset();
      return;
    }
    router.invalidate();
  };

  return (
    <EmptyState
      action={
        <Button onClick={handleRetry} variant="strand">
          Try again
        </Button>
      }
      description={message}
      Icon={RiErrorWarningFill}
      title="Something went wrong"
    />
  );
}

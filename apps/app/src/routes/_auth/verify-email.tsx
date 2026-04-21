import { createFileRoute } from "@tanstack/react-router";
import VerifyEmailPageComponent from "~/components/pages/auth-pages/verify-email-page";

interface VerifyEmailSearch {
  email?: string;
}

export const Route = createFileRoute("/_auth/verify-email")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => {
    const email = typeof search.email === "string" ? search.email : undefined;
    return { email };
  },
});

function RouteComponent() {
  return <VerifyEmailPageComponent />;
}

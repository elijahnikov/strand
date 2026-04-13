import { createFileRoute } from "@tanstack/react-router";
import LoginPageComponent from "~/components/pages/auth-pages/login-page";

interface LoginSearch {
  redirect?: string;
}

export const Route = createFileRoute("/_auth/login")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const r = typeof search.redirect === "string" ? search.redirect : undefined;
    return { redirect: r };
  },
});

function RouteComponent() {
  return <LoginPageComponent />;
}

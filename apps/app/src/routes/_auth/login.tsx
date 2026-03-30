import { createFileRoute } from "@tanstack/react-router";
import LoginPageComponent from "~/components/pages/auth-pages/login-page";

export const Route = createFileRoute("/_auth/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return <LoginPageComponent />;
}

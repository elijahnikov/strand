import { createFileRoute } from "@tanstack/react-router";
import RegisterPageComponent from "~/components/pages/auth-pages/register-page";

export const Route = createFileRoute("/_auth/register")({
  component: RouteComponent,
});

function RouteComponent() {
  return <RegisterPageComponent />;
}

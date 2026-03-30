import { Text } from "@strand/ui/text";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: AuthLayoutComponent,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
});

function AuthLayoutComponent() {
  return (
    <div className="relative flex min-h-screen min-w-screen flex-col items-center justify-center bg-ui-bg-subtle">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <img
          alt="Strand"
          className="rounded-lg"
          height={32}
          src="/STRAND.png"
          width={32}
        />
        <span className="font-semibold text-ui-fg-base">Strand</span>
      </div>
      <Outlet />
      <Text
        className="absolute bottom-6 max-w-sm text-center font-medium text-[11px] text-ui-fg-muted"
        size="xsmall"
      >
        By clicking "Continue" or signing up, you acknowledge that you have read
        and agree to Strand's{" "}
        <a className="text-ui-fg-base" href="/terms">
          Terms of Service
        </a>{" "}
        and{" "}
        <a className="text-ui-fg-base" href="/privacy">
          Privacy Policy
        </a>
        .
      </Text>
    </div>
  );
}

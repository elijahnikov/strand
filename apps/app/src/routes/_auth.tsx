import { Text } from "@omi/ui/text";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { safeRedirect } from "~/lib/safe-redirect";

export const Route = createFileRoute("/_auth")({
  component: AuthLayoutComponent,
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) {
      const target = safeRedirect(
        typeof (search as { redirect?: unknown }).redirect === "string"
          ? ((search as { redirect?: string }).redirect ?? undefined)
          : undefined
      );
      throw redirect({ to: target });
    }
  },
});

function AuthLayoutComponent() {
  return (
    <div className="relative flex min-h-screen min-w-screen flex-col items-center justify-center bg-ui-bg-subtle">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <img
          alt="omi"
          className="rounded-lg"
          height={32}
          src="/omi.png"
          width={32}
        />
        <span className="font-semibold text-ui-fg-base">omi</span>
      </div>
      <Outlet />
      <Text
        className="absolute bottom-6 max-w-sm text-center font-medium text-[11px] text-ui-fg-muted"
        size="xsmall"
      >
        By clicking "Continue" or signing up, you acknowledge that you have read
        and agree to omi's{" "}
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

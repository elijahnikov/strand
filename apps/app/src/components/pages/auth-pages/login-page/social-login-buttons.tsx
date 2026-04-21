import { authClient } from "@omi/auth/client";
import { Button } from "@omi/ui/button";
import { RiDiscordFill, RiGoogleFill } from "@remixicon/react";
import { useSearch } from "@tanstack/react-router";
import { safeRedirect } from "~/lib/safe-redirect";

export function SocialLoginButtons() {
  const { redirect } = useSearch({ from: "/_auth/login" });
  const target = safeRedirect(redirect);

  const handleSocialLogin = async (provider: "discord" | "google") => {
    const res = await authClient.signIn.social({
      provider,
      callbackURL: target,
    });

    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        onClick={() => handleSocialLogin("discord")}
        variant="secondary"
      >
        <RiDiscordFill className="size-4" />
        Continue with Discord
      </Button>
      <Button
        className="w-full"
        onClick={() => handleSocialLogin("google")}
        variant="secondary"
      >
        <RiGoogleFill className="size-4" />
        Continue with Google
      </Button>
    </div>
  );
}

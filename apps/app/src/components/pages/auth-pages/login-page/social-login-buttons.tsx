import { RiDiscordFill, RiGoogleFill } from "@remixicon/react";
import { authClient } from "@strand/auth/client";
import { Button } from "@strand/ui/button";

export function SocialLoginButtons() {
  const handleSocialLogin = async (provider: "discord" | "google") => {
    const res = await authClient.signIn.social({
      provider,
      callbackURL: "/",
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

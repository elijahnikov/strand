import { authClient } from "@omi/auth/client";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";

export default function VerifyEmailPageComponent() {
  const { email } = useSearch({ from: "/_auth/verify-email" });
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      return;
    }
    setIsResending(true);
    const res = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/",
    });
    setIsResending(false);

    if (res.error) {
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Could not resend email",
      });
      return;
    }

    toastManager.add({
      type: "success",
      title: "Verification email sent",
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="mx-auto flex flex-col justify-center text-center">
        <h1 className="font-semibold text-xl">Check your email</h1>
        <Text className="font-medium text-ui-fg-muted" size="small">
          {email
            ? `We sent a verification link to ${email}. Click it to finish setting up your account.`
            : "We sent you a verification link. Click it to finish setting up your account."}
        </Text>
      </div>

      {email ? (
        <LoadingButton
          className="w-full"
          loading={isResending}
          onClick={handleResend}
          type="button"
          variant="secondary"
        >
          Resend email
        </LoadingButton>
      ) : null}

      <Text className="text-center font-medium text-ui-fg-muted" size="xsmall">
        Back to{" "}
        <Link
          className="text-ui-fg-base underline"
          preload="viewport"
          to="/login"
        >
          sign in
        </Link>
      </Text>
    </div>
  );
}

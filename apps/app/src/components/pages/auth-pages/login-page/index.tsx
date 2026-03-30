import { Separator } from "@strand/ui/separator";
import { Text } from "@strand/ui/text";
import { Link } from "@tanstack/react-router";
import { EmailPasswordForm } from "./email-password-form";
import { SocialLoginButtons } from "./social-login-buttons";

export default function LoginPageComponent() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="mx-auto flex flex-col justify-center text-center">
        <h1 className="font-semibold text-xl">Welcome back</h1>
        <Text className="font-medium text-ui-fg-muted" size="small">
          Sign in to your account to continue
        </Text>
      </div>
      <EmailPasswordForm />
      <Separator />
      <SocialLoginButtons />

      <Text className="text-center font-medium text-ui-fg-muted" size="xsmall">
        Don't have an account?{" "}
        <Link
          className="text-ui-fg-base underline"
          preload="viewport"
          to="/register"
        >
          Sign up
        </Link>
      </Text>
    </div>
  );
}

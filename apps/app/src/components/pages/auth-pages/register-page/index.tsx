import { Separator } from "@strand/ui/separator";
import { Text } from "@strand/ui/text";
import { Link } from "@tanstack/react-router";
import { SocialLoginButtons } from "../login-page/social-login-buttons";
import { EmailPasswordRegisterForm } from "./email-password-form";

export default function RegisterPageComponent() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="mx-auto flex flex-col justify-center text-center">
        <h1 className="font-semibold text-xl">Create an account</h1>
        <Text className="font-medium text-ui-fg-muted" size="small">
          Get started with Strand
        </Text>
      </div>
      <EmailPasswordRegisterForm />
      <Separator />
      <SocialLoginButtons />

      <Text className="text-center font-medium text-ui-fg-muted" size="xsmall">
        Already have an account?{" "}
        <Link
          className="text-ui-fg-base underline"
          preload="viewport"
          to="/login"
        >
          Sign in
        </Link>
      </Text>
    </div>
  );
}

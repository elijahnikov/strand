import { authClient } from "@omi/auth/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@omi/ui/form";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { toastManager } from "@omi/ui/toast";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { safeRedirect } from "~/lib/safe-redirect";

interface LoginFormValues {
  email: string;
  password: string;
}

export function EmailPasswordForm() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/_auth/login" });
  const target = safeRedirect(redirect);

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const res = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (res.error) {
      const needsVerification =
        res.error.status === 403 || res.error.code === "EMAIL_NOT_VERIFIED";

      if (needsVerification) {
        await authClient.sendVerificationEmail({
          email: values.email,
          callbackURL: "/",
        });
        navigate({
          to: "/verify-email",
          search: { email: values.email },
        });
        return;
      }

      toastManager.add({
        type: "error",
        title: res.error.message ?? "Something went wrong",
      });
      return;
    }

    navigate({ to: target });
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="you@example.com" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
          rules={{ required: "Email is required" }}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="Enter your password"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
          rules={{ required: "Password is required" }}
        />
        <LoadingButton
          className="w-full"
          loading={form.formState.isSubmitting}
          type="submit"
          variant={"omi"}
        >
          Sign in
        </LoadingButton>
      </form>
    </Form>
  );
}

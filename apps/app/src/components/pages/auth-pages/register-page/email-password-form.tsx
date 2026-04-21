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
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";

interface RegisterFormValues {
  email: string;
  name: string;
  password: string;
}

export function EmailPasswordRegisterForm() {
  const navigate = useNavigate();

  const form = useForm<RegisterFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    const res = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (res.error) {
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Something went wrong",
      });
      return;
    }

    navigate({ to: "/" });
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
          rules={{ required: "Username is required" }}
        />
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
                  placeholder="Create a password"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
          rules={{
            required: "Password is required",
            minLength: {
              value: 8,
              message: "Password must be at least 8 characters",
            },
          }}
        />
        <LoadingButton
          className="w-full"
          loading={form.formState.isSubmitting}
          type="submit"
          variant={"omi"}
        >
          Create account
        </LoadingButton>
      </form>
    </Form>
  );
}

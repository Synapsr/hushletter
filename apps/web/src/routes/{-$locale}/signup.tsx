import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hushletter/ui";
import { signUp } from "@/lib/auth-client";
import { extractNameFromEmail } from "@/lib/utils/error";
import { useAppForm } from "@/hooks/form/form";
import { revalidateLogic } from "@tanstack/react-form";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/{-$locale}/signup")({
  component: SignupPage,
});

const signupSchema = z.object({
  email: z.string().email(m.auth_invalidEmail()),
  password: z.string().min(8, m.auth_passwordMinLength()),
});

function SignupPage() {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (value: { email: string; password: string }) => {
      const result = await signUp.email(
        {
          email: value.email,
          password: value.password,
          name: extractNameFromEmail(value.email),
        },
        {
          onError: (ctx) => {
            const errorCode = ctx.error?.code;
            const errorMessage = ctx.error?.message;

            if (
              errorCode === "USER_ALREADY_EXISTS" ||
              errorMessage?.toLowerCase().includes("already exists")
            ) {
              throw new Error(m.auth_emailExists());
            }

            throw new Error(errorMessage || m.auth_registrationFailed());
          },
        },
      );

      return result;
    },
    onError: (error) => {
      toast.error(error.message || m.auth_registrationFailed());
    },
    onSuccess: () => {
      navigate({ to: "/onboarding" });
    },
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onSubmit: signupSchema,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {m.auth_signupTitle()}
          </CardTitle>
          <CardDescription>{m.auth_signupSubtitle()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form.Form className="">
              <form.AppField name="email">
                {(field) => (
                  <field.Input
                    label={m.auth_email()}
                    type="email"
                    placeholder={m.auth_emailPlaceholder()}
                    autoComplete="email"
                  />
                )}
              </form.AppField>

              <form.AppField name="password">
                {(field) => (
                  <field.Input
                    label={m.auth_password()}
                    type="password"
                    placeholder={m.auth_passwordPlaceholderMin()}
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>

              <form.SubscribeButton type="submit" className="w-full">
                {m.auth_signUp()}
              </form.SubscribeButton>
            </form.Form>
          </form.AppForm>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {m.auth_hasAccount()}{" "}
            <Link
              to="/{-$locale}/login"
              className="font-medium text-primary hover:underline"
            >
              {m.auth_signInLink()}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

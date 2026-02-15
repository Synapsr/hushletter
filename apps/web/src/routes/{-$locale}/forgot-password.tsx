import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hushletter/ui";
import { authClient } from "@/lib/auth-client";
import { useAppForm } from "@/hooks/form/form";
import { revalidateLogic } from "@tanstack/react-form";
import { m } from "@/paraglide/messages.js";
import { useState } from "react";

export const Route = createFileRoute("/{-$locale}/forgot-password")({
  component: ForgotPasswordPage,
});

const forgotPasswordSchema = z.object({
  email: z.string().email(m.auth_invalidEmail()),
});

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async (value: { email: string }) => {
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },
    // Always show success to prevent email enumeration
    onError: () => {
      setSubmitted(true);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onSubmit: forgotPasswordSchema,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {m.auth_forgotPasswordTitle()}
          </CardTitle>
          <CardDescription>
            {m.auth_forgotPasswordSubtitle()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {m.auth_forgotPasswordSuccess()}
              </p>
              <Link
                to="/{-$locale}/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                {m.auth_backToLogin()}
              </Link>
            </div>
          ) : (
            <>
              <form.AppForm>
                <form.Form className="space-y-4">
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

                  <form.SubscribeButton type="submit" className="w-full">
                    {m.auth_forgotPasswordSubmit()}
                  </form.SubscribeButton>
                </form.Form>
              </form.AppForm>

              <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                <Link
                  to="/{-$locale}/login"
                  className="font-medium text-primary hover:underline"
                >
                  {m.auth_backToLogin()}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

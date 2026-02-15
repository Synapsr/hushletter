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
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";
import { useState } from "react";

export const Route = createFileRoute("/{-$locale}/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, m.auth_passwordMinLength()),
  confirmPassword: z.string().min(1, m.auth_passwordRequired()),
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const [success, setSuccess] = useState(false);

  // Invalid or expired token
  if (error === "INVALID_TOKEN" || (!token && !success)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {m.auth_resetPasswordTitle()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-destructive">
              {m.auth_resetPasswordExpired()}
            </p>
            <Link
              to="/{-$locale}/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              {m.auth_forgotPasswordSubmit()}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Success state
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {m.auth_resetPasswordTitle()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-green-600">
              {m.auth_resetPasswordSuccess()}
            </p>
            <Link
              to="/{-$locale}/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              {m.auth_backToLogin()}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <ResetPasswordForm token={token!} onSuccess={() => setSuccess(true)} />
  );
}

function ResetPasswordForm({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async (value: { newPassword: string }) => {
      const result = await authClient.resetPassword({
        newPassword: value.newPassword,
        token,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },
    onError: (error) => {
      toast.error(error.message || m.auth_resetPasswordFailed());
    },
    onSuccess: () => {
      toast.success(m.auth_resetPasswordSuccess());
      onSuccess();
    },
  });

  const form = useAppForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmPassword) {
        toast.error(m.auth_resetPasswordMismatch());
        return;
      }
      await mutation.mutateAsync({ newPassword: value.newPassword });
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onSubmit: resetPasswordSchema,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {m.auth_resetPasswordTitle()}
          </CardTitle>
          <CardDescription>{m.auth_resetPasswordSubtitle()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form.Form className="">
              <form.AppField name="newPassword">
                {(field) => (
                  <field.Input
                    label={m.auth_resetPasswordNewPassword()}
                    type="password"
                    placeholder={m.auth_passwordPlaceholderMin()}
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>

              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.Input
                    label={m.auth_resetPasswordConfirmPassword()}
                    type="password"
                    placeholder={m.auth_resetPasswordConfirmPlaceholder()}
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>

              <form.SubscribeButton type="submit" className="w-full">
                {m.auth_resetPasswordSubmit()}
              </form.SubscribeButton>
            </form.Form>
          </form.AppForm>
        </CardContent>
      </Card>
    </main>
  );
}

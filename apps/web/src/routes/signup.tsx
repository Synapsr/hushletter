import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hushletter/ui";
import { signUp } from "@/lib/auth-client";
import { extractNameFromEmail } from "@/lib/utils/error";
import { useAppForm } from "@/hooks/form/form";
import { revalidateLogic } from "@tanstack/react-form";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
              throw new Error("An account with this email already exists");
            }

            throw new Error(errorMessage || "Registration failed. Please try again.");
          },
        },
      );

      return result;
    },
    onError: (error) => {
      toast.error(error.message || "Registration failed. Please try again.");
    },
    onSuccess: () => {
      navigate({ to: "/newsletters" });
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
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Start organizing your newsletters today</CardDescription>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form.Form className="space-y-4">
              <form.AppField name="email">
                {(field) => (
                  <field.Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                )}
              </form.AppField>

              <form.AppField name="password">
                {(field) => (
                  <field.Input
                    label="Password"
                    type="password"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                  />
                )}
              </form.AppField>

              <form.SubscribeButton type="submit" className="w-full">
                Sign Up
              </form.SubscribeButton>
            </form.Form>
          </form.AppForm>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

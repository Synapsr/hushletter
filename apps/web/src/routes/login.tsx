import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hushletter/ui";
import { signIn } from "@/lib/auth-client";
import { useAppForm } from "@/hooks/form/form";
import { revalidateLogic } from "@tanstack/react-form";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function LoginPage() {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (value: { email: string; password: string }) => {
      const result = await signIn.email({
        email: value.email,
        password: value.password,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },
    onError: (error) => {
      toast.error(error.message || "Invalid email or password");
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
      onSubmit: loginSchema,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your newsletters</CardDescription>
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
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                )}
              </form.AppField>

              <form.SubscribeButton type="submit" className="w-full">
                Sign In
              </form.SubscribeButton>
            </form.Form>
          </form.AppForm>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
              onClick={() => {
                // Placeholder for future password reset story
              }}
            >
              Forgot your password?
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

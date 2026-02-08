import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@hushletter/ui";
import { signIn } from "@/lib/auth-client";
import { useAppForm } from "@/hooks/form/form";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// Zod schema for form validation - simpler than signup (just needs non-empty values)
const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function LoginPage() {
  const navigate = useNavigate();

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onChange: loginSchema,
    },
    onSubmit: async ({ value }) => {
      // Use promise-based API (not callbacks) so errors propagate correctly
      const result = await signIn.email({
        email: value.email,
        password: value.password,
      });

      // Check for error in result - Better Auth returns { error } on failure
      if (result.error) {
        // Always use generic message for security - prevents user enumeration
        throw new Error("Invalid email or password");
      }

      // Success - navigate to newsletters
      navigate({ to: "/newsletters" });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your newsletters</CardDescription>
        </CardHeader>
        <CardContent render={<form.AppForm />}>
          <form.Form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {/* Email Field */}
            <form.Field
              name="email"
              children={(field) => {
                const hasErrors = field.state.meta.errors.length > 0;
                const errorId = `${field.name}-error`;
                return (
                  <div className="space-y-2">
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Email
                    </label>
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="you@example.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      aria-invalid={hasErrors}
                      aria-describedby={hasErrors ? errorId : undefined}
                      /* className={
                        hasErrors ? "border-destructive focus-visible:ring-destructive" : ""
                      } */
                    />
                    {field.state.meta.errors.map((error, i) => (
                      <p
                        key={i}
                        id={i === 0 ? errorId : undefined}
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {String(error)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />

            {/* Password Field */}
            <form.Field
              name="password"
              children={(field) => {
                const hasErrors = field.state.meta.errors.length > 0;
                const errorId = `${field.name}-error`;
                return (
                  <div className="space-y-2">
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Password
                    </label>
                    <Input
                      id={field.name}
                      type="password"
                      placeholder="Enter your password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      aria-invalid={hasErrors}
                      aria-describedby={hasErrors ? errorId : undefined}
                      className={
                        hasErrors ? "border-destructive focus-visible:ring-destructive" : ""
                      }
                    />
                    {field.state.meta.errors.map((error, i) => (
                      <p
                        key={i}
                        id={i === 0 ? errorId : undefined}
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {String(error)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />

            {/* Form-level errors from onSubmit */}
            <form.Subscribe
              selector={(state) => state.errorMap.onSubmit}
              children={(submitError) =>
                submitError ? (
                  <div
                    className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    role="alert"
                  >
                    {String(submitError)}
                  </div>
                ) : null
              }
            />

            {/* Submit button with loading state */}
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              )}
            />
          </form.Form>

          {/* Forgot password placeholder - non-functional, for future story */}
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
              onClick={() => {
                // Placeholder for future password reset story
                // Will navigate to /forgot-password when implemented
              }}
            >
              Forgot your password?
            </button>
          </div>

          {/* Sign up link */}
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

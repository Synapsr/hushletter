import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "~/lib/auth-client";
import { getErrorMessage, extractNameFromEmail } from "~/lib/utils/error";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

// Zod schema for form validation
const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function SignupPage() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onChange: signupSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await signUp.email(
          {
            email: value.email,
            password: value.password,
            name: extractNameFromEmail(value.email),
          },
          {
            onSuccess: () => {
              navigate({ to: "/newsletters" });
            },
            onError: (ctx) => {
              // Handle specific error codes from Better Auth
              const errorCode = ctx.error?.code;
              const errorMessage = ctx.error?.message;

              if (
                errorCode === "USER_ALREADY_EXISTS" ||
                errorMessage?.toLowerCase().includes("already exists")
              ) {
                throw new Error("An account with this email already exists");
              }

              // Provide user-friendly message for other errors
              throw new Error(errorMessage || "Registration failed. Please try again.");
            },
          },
        );
      } catch (error) {
        // Return error to be displayed via form.Subscribe
        throw new Error(getErrorMessage(error));
      }
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Start organizing your newsletters today
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {/* Email Field */}
            <form.Field
              name="email"
              children={(field) => (
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
                    className={
                      field.state.meta.errors.length > 0
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {field.state.meta.errors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {getErrorMessage(error)}
                    </p>
                  ))}
                </div>
              )}
            />

            {/* Password Field */}
            <form.Field
              name="password"
              children={(field) => (
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
                    placeholder="Min 8 characters"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className={
                      field.state.meta.errors.length > 0
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {field.state.meta.errors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {getErrorMessage(error)}
                    </p>
                  ))}
                </div>
              )}
            />

            {/* Form-level errors from onSubmit */}
            <form.Subscribe
              selector={(state) => state.errorMap.onSubmit}
              children={(submitError) =>
                submitError ? (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {getErrorMessage(submitError)}
                  </div>
                ) : null
              }
            />

            {/* Submit button with loading state */}
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Sign Up"}
                </Button>
              )}
            />
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

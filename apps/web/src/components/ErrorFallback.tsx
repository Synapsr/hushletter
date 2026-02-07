import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
}

/**
 * User-friendly error fallback component.
 * Does NOT expose stack traces or implementation details.
 */
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // Log error for debugging (server-side or dev tools)
  console.error("Application error:", error);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-destructive">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            We encountered an unexpected error. Please try again or return to the home page.
          </p>

          <div className="flex flex-col gap-2">
            {resetErrorBoundary && (
              <Button onClick={resetErrorBoundary} variant="default">
                Try Again
              </Button>
            )}
            <Link to="/">
              <Button variant="outline" className="w-full">
                Return Home
              </Button>
            </Link>
          </div>

          {/* Show error ID for support - NOT the actual error message */}
          <p className="text-xs text-gray-400 mt-4">Error ID: {Date.now().toString(36)}</p>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Simple inline error component for router errors.
 */
export function RouterErrorComponent({ error }: { error: Error }) {
  return <ErrorFallback error={error} />;
}

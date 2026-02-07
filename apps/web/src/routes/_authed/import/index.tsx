/**
 * Import Page - Gmail Integration Entry Point
 * Story 4.1: Task 2 (AC #1, #4)
 * Story 4.2: Task 5 - Integrate SenderScanner
 *
 * Allows users to connect their Gmail account for importing newsletters.
 * This page serves as the hub for all import-related functionality.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useQuery } from "convex/react";
import { api } from "@hushletter/backend";
import { GmailConnect } from "./-GmailConnect";
import { SenderScanner } from "./-SenderScanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Upload, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authed/import/")({
  component: ImportPage,
});

/**
 * Error fallback for GmailConnect component failures
 * Per project-context.md: "Use feature-level error boundaries"
 */
/**
 * Error fallback for component failures
 * Per project-context.md: "Use feature-level error boundaries"
 */
function ComponentError({
  error,
  resetErrorBoundary,
  title,
  description,
}: FallbackProps & { title: string; description: string }) {
  // react-error-boundary v6 types error as unknown, safely extract message
  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button onClick={resetErrorBoundary} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

function GmailConnectError(props: FallbackProps) {
  return (
    <ComponentError
      {...props}
      title="Gmail Integration Error"
      description="Something went wrong loading the Gmail connection"
    />
  );
}

function SenderScannerError(props: FallbackProps) {
  return (
    <ComponentError
      {...props}
      title="Scanner Error"
      description="Something went wrong with the newsletter scanner"
    />
  );
}

function ImportPage() {
  // Query Gmail connection status to conditionally show scanner
  // Story 4.2: Task 5.1 - Show SenderScanner only when Gmail is connected
  const gmailAccount = useQuery(api.gmail.getGmailAccount);
  const isGmailConnected = gmailAccount !== null && gmailAccount !== undefined;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Import Newsletters</h1>
      <p className="text-muted-foreground mb-8">
        Connect your email accounts to import existing newsletters and discover new ones.
      </p>

      <div className="space-y-6">
        {/* Gmail Connection Section with Error Boundary */}
        <ErrorBoundary FallbackComponent={GmailConnectError}>
          <GmailConnect />
        </ErrorBoundary>

        {/* Newsletter Scanner - shown only when Gmail is connected */}
        {/* Story 4.2: Task 5.1 - Conditionally show SenderScanner */}
        {isGmailConnected && (
          <ErrorBoundary FallbackComponent={SenderScannerError}>
            <SenderScanner />
          </ErrorBoundary>
        )}

        {/* Manual Import Section - Story 8.2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Manual Import
            </CardTitle>
            <CardDescription>
              Import newsletters from .eml files exported from your email client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have newsletters saved as .eml files, you can drag and drop them to import them
              into Hushletter.
            </p>
            <Button asChild>
              <Link to="/import/manual">
                Import .eml Files
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

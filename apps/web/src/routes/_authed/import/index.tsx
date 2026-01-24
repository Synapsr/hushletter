/**
 * Import Page - Gmail Integration Entry Point
 * Story 4.1: Task 2 (AC #1, #4)
 *
 * Allows users to connect their Gmail account for importing newsletters.
 * This page serves as the hub for all import-related functionality.
 */

import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"
import { GmailConnect } from "./GmailConnect"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { AlertCircle, RefreshCw } from "lucide-react"

export const Route = createFileRoute("/_authed/import/")({
  component: ImportPage,
})

/**
 * Error fallback for GmailConnect component failures
 * Per project-context.md: "Use feature-level error boundaries"
 */
function GmailConnectError({ error, resetErrorBoundary }: FallbackProps) {
  // react-error-boundary v6 types error as unknown, safely extract message
  const errorMessage = error instanceof Error
    ? error.message
    : "An unexpected error occurred. Please try again."

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          Gmail Integration Error
        </CardTitle>
        <CardDescription>
          Something went wrong loading the Gmail connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {errorMessage}
        </p>
        <Button onClick={resetErrorBoundary} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  )
}

function ImportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Import Newsletters
      </h1>
      <p className="text-muted-foreground mb-8">
        Connect your email accounts to import existing newsletters and discover
        new ones.
      </p>

      {/* Gmail Connection Section with Error Boundary */}
      <ErrorBoundary FallbackComponent={GmailConnectError}>
        <GmailConnect />
      </ErrorBoundary>
    </div>
  )
}

/**
 * ImportProgress Component
 * Story 4.4: Task 6 (AC #1, #3, #4, #5)
 *
 * Displays real-time import progress for historical email import.
 * Features:
 * - Progress bar with imported/total count (AC#1)
 * - Completion summary with imported/skipped/failed counts (AC#3)
 * - Error count display (AC#4)
 * - Progress persistence across page refresh (AC#5)
 */

import { useState } from "react"
import { useQuery, useAction } from "convex/react"
import { api } from "@hushletter/backend"
import { Link } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  SkipForward,
  XCircle,
  ArrowRight,
} from "lucide-react"

/**
 * Types for import progress
 */
type ImportProgressData = {
  status: "pending" | "importing" | "complete" | "error"
  totalEmails: number
  importedEmails: number
  failedEmails: number
  skippedEmails: number
  startedAt: number
  completedAt?: number
  error?: string
}

/**
 * Loading skeleton for the component
 */
function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="h-10 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

/**
 * Importing state - shows progress bar and counts
 * Story 4.4: Task 6.1, 6.2 (AC#1)
 */
function ImportingState({ progress }: { progress: ImportProgressData }) {
  const processedEmails =
    progress.importedEmails + progress.failedEmails + progress.skippedEmails
  const percentage =
    progress.totalEmails > 0
      ? Math.round((processedEmails / progress.totalEmails) * 100)
      : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
        <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
        </div>
        <div>
          <p className="font-medium text-yellow-800 dark:text-yellow-200">
            Importing Newsletters...
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            This may take a few moments depending on your email history
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <Progress value={percentage} />
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>
          Processing {processedEmails} of {progress.totalEmails} emails
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xl font-bold">{progress.importedEmails}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Imported</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <SkipForward className="h-4 w-4" />
            <span className="text-xl font-bold">{progress.skippedEmails}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Skipped</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-center gap-1 text-red-500">
            <XCircle className="h-4 w-4" />
            <span className="text-xl font-bold">{progress.failedEmails}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Failed</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Complete state - shows summary and navigation
 * Story 4.4: Task 6.3, 6.4 (AC#3)
 */
function CompleteState({
  progress,
}: {
  progress: ImportProgressData
}) {
  const totalProcessed =
    progress.importedEmails + progress.failedEmails + progress.skippedEmails

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Import Complete!
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Successfully imported {progress.importedEmails} newsletter
            {progress.importedEmails !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Import Summary
        </h3>

        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span>Imported</span>
            </div>
            <span className="font-medium">{progress.importedEmails}</span>
          </div>

          {progress.skippedEmails > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Skipped (duplicates)
                </span>
              </div>
              <span className="text-muted-foreground">
                {progress.skippedEmails}
              </span>
            </div>
          )}

          {progress.failedEmails > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">Failed</span>
              </div>
              <span className="text-red-600 dark:text-red-400">
                {progress.failedEmails}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Processed {totalProcessed} of {progress.totalEmails} emails
        </p>
      </div>

      <Button asChild className="w-full">
        <Link to="/newsletters">
          <Mail className="mr-2 h-4 w-4" />
          View Newsletters
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

/**
 * Error state - shows error message and retry option
 * Story 4.4: Task 6.3 (AC#4)
 */
function ErrorState({
  progress,
  onRetry,
  isRetrying,
}: {
  progress: ImportProgressData
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">
            Import Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {progress.error || "An unexpected error occurred"}
          </p>
        </div>
      </div>

      {progress.importedEmails > 0 && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            {progress.importedEmails} email
            {progress.importedEmails !== 1 ? "s were" : " was"} successfully
            imported before the error occurred.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          variant="outline"
          className="flex-1"
        >
          {isRetrying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            "Try Again"
          )}
        </Button>
        {progress.importedEmails > 0 && (
          <Button asChild className="flex-1">
            <Link to="/newsletters">View Imported</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * ImportProgress - Main component for showing import progress
 * Story 4.4: Task 6 (All ACs)
 */
export function ImportProgress({
  onBack,
}: {
  onBack?: () => void
}) {
  // Query import progress (reactive - updates in real-time via Convex)
  const importProgress = useQuery(api.gmail.getImportProgress) as
    | ImportProgressData
    | null
    | undefined

  // Action to restart import
  const startImport = useAction(api.gmail.startHistoricalImport)

  // Local state for retry tracking
  const [isRetrying, setIsRetrying] = useState(false)

  // Handle retry
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await startImport()
    } catch (error) {
      console.error("[ImportProgress] Retry failed:", error)
    } finally {
      setIsRetrying(false)
    }
  }

  // Show loading skeleton while fetching initial state
  if (importProgress === undefined) {
    return <LoadingSkeleton />
  }

  // No import in progress or started
  if (!importProgress) {
    return null
  }

  const { status } = importProgress

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {status === "pending"
            ? "Import Queued"
            : status === "importing"
              ? "Importing Newsletters"
              : status === "complete"
                ? "Import Complete"
                : status === "error"
                  ? "Import Error"
                  : "Import"}
        </CardTitle>
        <CardDescription>
          {status === "pending"
            ? "Your import is queued and will start shortly"
            : status === "importing"
              ? "Downloading your newsletters from Gmail"
              : status === "complete"
                ? "Your newsletters have been imported"
                : status === "error"
                  ? "Something went wrong during import"
                  : "Import progress"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Pending state - reserved for future queue-based imports */}
        {status === "pending" && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Preparing Import...
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Your import will start shortly
              </p>
            </div>
          </div>
        )}
        {status === "importing" && <ImportingState progress={importProgress} />}
        {status === "complete" && <CompleteState progress={importProgress} />}
        {status === "error" && (
          <ErrorState
            progress={importProgress}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}
      </CardContent>

      {onBack && status !== "importing" && (
        <CardFooter>
          <Button variant="outline" onClick={onBack}>
            Back to Import
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

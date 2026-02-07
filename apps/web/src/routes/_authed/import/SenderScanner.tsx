/**
 * SenderScanner Component
 * Story 4.2: Task 4 - Scanning UI Components
 *
 * Provides interface for scanning Gmail for newsletter senders.
 * Shows scan progress in real-time and displays detected senders.
 */

import { useState, useRef, useEffect } from "react"
import { useQuery, useAction } from "convex/react"
import { api } from "@hushletter/backend"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import {
  Search,
  Loader2,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Inbox,
} from "lucide-react"
import { SenderReview } from "./SenderReview"
import { ImportProgress } from "./ImportProgress"

/**
 * Types for scan progress and detected senders
 */
type ScanProgress = {
  status: "scanning" | "complete" | "error"
  totalEmails: number
  processedEmails: number
  sendersFound: number
  error?: string
}

type DetectedSender = {
  _id: string
  email: string
  name?: string
  domain: string
  emailCount: number
  confidenceScore: number
  sampleSubjects: string[]
}

/**
 * Loading skeleton for the component
 * Story 4.2: Task 4.2 - Loading state
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
 * Idle state - no scan started yet
 * Story 4.2: Task 4.2 - "Scan for Newsletters" button
 */
function IdleState({
  onStartScan,
  isStarting,
}: {
  onStartScan: () => void
  isStarting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="font-medium text-blue-800 dark:text-blue-200">
            Find Your Newsletters
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Scan your Gmail to discover newsletters you&apos;re subscribed to
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        We&apos;ll look for emails with newsletter characteristics like
        unsubscribe links, known newsletter platforms, and mailing list headers.
      </p>

      <Button
        onClick={onStartScan}
        disabled={isStarting}
        className="w-full"
        size="lg"
      >
        {isStarting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Scan...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Scan for Newsletters
          </>
        )}
      </Button>
    </div>
  )
}

/**
 * Scanning state - shows progress
 * Story 4.2: Task 4.3 - Progress indicator
 */
function ScanningState({ progress }: { progress: ScanProgress }) {
  const percentComplete =
    progress.totalEmails > 0
      ? Math.round((progress.processedEmails / progress.totalEmails) * 100)
      : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
        <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
        </div>
        <div>
          <p className="font-medium text-yellow-800 dark:text-yellow-200">
            Scanning Your Gmail...
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            This may take a few moments depending on your inbox size
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{percentComplete}%</span>
        </div>
        <Progress value={percentComplete} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-2xl font-bold">{progress.processedEmails}</p>
          <p className="text-xs text-muted-foreground">Emails Scanned</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-2xl font-bold">{progress.sendersFound}</p>
          <p className="text-xs text-muted-foreground">Senders Found</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state - scan complete but no newsletters found
 * Story 4.2: Task 4.5 - Empty state with rescan option
 */
function EmptyState({
  onRescan,
  isRescanning,
}: {
  onRescan: () => void
  isRescanning: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Inbox className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="font-medium">No Newsletters Found</p>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find any newsletters in your Gmail
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        This could happen if you don&apos;t have newsletters in your inbox, or
        if they don&apos;t have standard newsletter headers. You can try
        scanning again or use your dedicated email address to subscribe to
        newsletters.
      </p>

      <Button
        onClick={onRescan}
        disabled={isRescanning}
        variant="outline"
        className="w-full"
      >
        {isRescanning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Scan...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan Again
          </>
        )}
      </Button>
    </div>
  )
}

/**
 * Error state - scan failed
 * Story 4.2: Task 4.6 - Error state handling
 */
function ErrorState({
  error,
  onRetry,
  isRetrying,
}: {
  error: string
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
            Scan Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>

      <Button
        onClick={onRetry}
        disabled={isRetrying}
        variant="outline"
        className="w-full"
      >
        {isRetrying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Scan...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </>
        )}
      </Button>
    </div>
  )
}

/**
 * Sender list item
 * Story 4.2: Task 4.4 - Detected senders list
 */
function SenderItem({ sender }: { sender: DetectedSender }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
        <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{sender.name || sender.email}</p>
        {sender.name && (
          <p className="text-sm text-muted-foreground truncate">
            {sender.email}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""} found
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            sender.confidenceScore >= 80
              ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              : sender.confidenceScore >= 50
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {sender.confidenceScore >= 80
            ? "High"
            : sender.confidenceScore >= 50
              ? "Medium"
              : "Low"}
        </span>
      </div>
    </div>
  )
}

/**
 * Complete state - show detected senders with option to review
 * Story 4.2: Task 4.4 - Detected senders list
 * Story 4.3: Updated to enable "Review & Approve" button
 */
function CompleteState({
  senders,
  onRescan,
  isRescanning,
  onReview,
}: {
  senders: DetectedSender[]
  onRescan: () => void
  isRescanning: boolean
  onReview: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Scan Complete
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Found {senders.length} newsletter sender
            {senders.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {senders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Detected Newsletter Senders
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {senders.map((sender) => (
              <SenderItem key={sender._id} sender={sender} />
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Review the detected senders and select which ones to import.
      </p>

      <div className="flex gap-3">
        <Button onClick={onReview} className="flex-1">
          Review &amp; Approve Senders
        </Button>
        <Button
          onClick={onRescan}
          disabled={isRescanning}
          variant="outline"
          size="icon"
          title="Rescan"
        >
          {isRescanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * View state type for the scanner component
 * Story 4.3: Added "review" view for sender review step
 * Story 4.4: Added "importing" view for import progress
 */
type ScannerView = "scanner" | "review" | "importing"

/**
 * SenderScanner - Main component for scanning Gmail for newsletters
 * Story 4.2: Task 4 (All ACs)
 * Story 4.3: Added review view integration
 * Story 4.4: Added importing view integration
 */
export function SenderScanner() {
  // Query scan progress (reactive - updates in real-time)
  const scanProgress = useQuery(api.gmail.getScanProgress) as
    | ScanProgress
    | null
    | undefined

  // Query detected senders
  const detectedSenders = useQuery(api.gmail.getDetectedSenders) as
    | DetectedSender[]
    | undefined

  // Story 4.4: Query import progress to check for active imports
  const importProgress = useQuery(api.gmail.getImportProgress) as
    | { status: string }
    | null
    | undefined

  // Mutation to start scan
  const startScan = useAction(api.gmail.startScan)

  // Local state for tracking if we're starting a scan
  // (action is async, need to track initiating state)
  const [isStarting, setIsStarting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  // Story 4.3: View state for scanner vs review
  // Story 4.4: Added "importing" view
  const [currentView, setCurrentView] = useState<ScannerView>("scanner")

  // Story 4.4: Check for active imports on mount and show import view if needed
  useEffect(() => {
    if (importProgress?.status === "importing") {
      setCurrentView("importing")
    }
  }, [importProgress?.status])

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Handle start scan
  const handleStartScan = async () => {
    setIsStarting(true)
    setLocalError(null)

    try {
      const result = await startScan()
      // Only update state if still mounted
      if (isMountedRef.current) {
        if (!result.success && result.error) {
          setLocalError(result.error)
        }
      }
    } catch (error) {
      console.error("[SenderScanner] Failed to start scan:", error)
      if (isMountedRef.current) {
        setLocalError("Failed to start scan. Please try again.")
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false)
      }
    }
  }

  // Story 4.4: If in importing view, show the ImportProgress component
  if (currentView === "importing") {
    return (
      <ImportProgress
        onBack={() => setCurrentView("scanner")}
      />
    )
  }

  // Story 4.3: If in review view, show the SenderReview component
  if (currentView === "review") {
    return (
      <SenderReview
        onBack={() => setCurrentView("scanner")}
        onStartImport={() => setCurrentView("importing")}
      />
    )
  }

  // Show loading skeleton while fetching initial state
  if (scanProgress === undefined) {
    return <LoadingSkeleton />
  }

  // Determine current state
  const isScanning = scanProgress?.status === "scanning"
  const isComplete = scanProgress?.status === "complete"
  const hasError = scanProgress?.status === "error" || localError
  const errorMessage = localError || scanProgress?.error || "An error occurred"
  const isEmpty = isComplete && (detectedSenders?.length ?? 0) === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Newsletter Scanner
        </CardTitle>
        <CardDescription>
          Scan your Gmail to find newsletters and import them
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasError ? (
          <ErrorState
            error={errorMessage}
            onRetry={handleStartScan}
            isRetrying={isStarting}
          />
        ) : isScanning ? (
          <ScanningState progress={scanProgress} />
        ) : isComplete ? (
          isEmpty ? (
            <EmptyState onRescan={handleStartScan} isRescanning={isStarting} />
          ) : (
            <CompleteState
              senders={detectedSenders ?? []}
              onRescan={handleStartScan}
              isRescanning={isStarting}
              onReview={() => setCurrentView("review")}
            />
          )
        ) : (
          <IdleState onStartScan={handleStartScan} isStarting={isStarting} />
        )}
      </CardContent>
    </Card>
  )
}


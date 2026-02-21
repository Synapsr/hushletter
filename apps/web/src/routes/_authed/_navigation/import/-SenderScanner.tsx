/**
 * SenderScanner Component
 *
 * Provides interface for scanning Gmail for newsletter senders.
 * Auto-starts scan on mount and transitions directly to review when done.
 * Flow: Scan → Review → Import (3 steps)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Button, Progress } from "@hushletter/ui";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { SenderReview } from "./-SenderReview";
import { ImportProgress } from "./-ImportProgress";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

/**
 * Types for scan progress and detected senders
 */
type ScanProgress = {
  status: "scanning" | "complete" | "error";
  totalEmails: number;
  processedEmails: number;
  sendersFound: number;
  error?: string;
};

type DetectedSender = {
  _id: string;
  email: string;
  name?: string;
  domain: string;
  emailCount: number;
  confidenceScore: number;
  sampleSubjects: string[];
};

function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/**
 * Scanning state — shows real-time progress
 */
function ScanningState({ progress }: { progress: ScanProgress }) {
  const percentComplete =
    progress.totalEmails > 0
      ? Math.min(
          100,
          Math.round((progress.processedEmails / progress.totalEmails) * 100),
        )
      : 0;

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Scanning your inbox...</p>
          <p className="text-xs text-muted-foreground">
            Looking for newsletters and subscriptions
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress value={percentComplete} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {progress.processedEmails.toLocaleString()} emails scanned
          </span>
          <span>{progress.sendersFound} senders found</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state — scan complete, no newsletters found
 */
function EmptyState({
  onRescan,
  isRescanning,
}: {
  onRescan: () => void;
  isRescanning: boolean;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">No newsletters found</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            We couldn&apos;t detect newsletters in this inbox. Try scanning
            again or subscribe using your dedicated address.
          </p>
        </div>
      </div>
      <Button
        onClick={onRescan}
        disabled={isRescanning}
        variant="outline"
        className="w-full"
      >
        {isRescanning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting scan...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan again
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Error state — scan failed with retry
 */
function ErrorState({
  error,
  onRetry,
  isRetrying,
}: {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Scan failed
          </p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/80">
            {error}
          </p>
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
            Retrying...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </>
        )}
      </Button>
    </div>
  );
}

type ScannerView = "scanner" | "importing";

/**
 * SenderScanner — scans Gmail for newsletters and manages the scan→review→import flow
 */
export function SenderScanner({
  gmailConnectionId,
}: {
  gmailConnectionId: Id<"gmailConnections">;
}) {
  const scanProgress = useQuery(api.gmail.getScanProgress, {
    gmailConnectionId,
  }) as ScanProgress | null | undefined;

  const detectedSenders = useQuery(api.gmail.getDetectedSenders, {
    gmailConnectionId,
  }) as DetectedSender[] | undefined;

  const importProgress = useQuery(api.gmail.getImportProgress, {
    gmailConnectionId,
  }) as { status: string } | null | undefined;

  const startScan = useAction(api.gmail.startScan);

  const [isStarting, setIsStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ScannerView>("scanner");

  // Auto-switch to import view if import is already running
  useEffect(() => {
    if (importProgress?.status === "importing") {
      setCurrentView("importing");
    }
  }, [importProgress?.status]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStartScan = useCallback(async () => {
    setIsStarting(true);
    setLocalError(null);

    try {
      const result = await startScan({ gmailConnectionId });
      if (isMountedRef.current) {
        if (!result.success && result.error) {
          setLocalError(result.error);
        }
      }
    } catch (error) {
      console.error("[SenderScanner] Failed to start scan:", error);
      if (isMountedRef.current) {
        setLocalError("Failed to start scan. Please try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [gmailConnectionId, startScan]);

  // Auto-start scan when no prior scan exists
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (scanProgress === null && !isStarting && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      void handleStartScan();
    }
  }, [handleStartScan, isStarting, scanProgress]);

  if (currentView === "importing") {
    return (
      <ImportProgress
        gmailConnectionId={gmailConnectionId}
        onBack={() => setCurrentView("scanner")}
      />
    );
  }

  const hasDetectedSenders = (detectedSenders?.length ?? 0) > 0;
  const shouldShowReview =
    currentView === "scanner" &&
    scanProgress?.status === "complete" &&
    hasDetectedSenders;

  if (shouldShowReview) {
    return (
      <SenderReview
        gmailConnectionId={gmailConnectionId}
        onStartImport={() => setCurrentView("importing")}
      />
    );
  }

  if (scanProgress === undefined) {
    return <LoadingSkeleton />;
  }

  const isComplete = scanProgress?.status === "complete";
  const hasError = scanProgress?.status === "error" || localError;
  const errorMessage = localError || scanProgress?.error || "An error occurred";
  const isEmpty = isComplete && !hasDetectedSenders;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {hasError ? (
        <ErrorState
          error={errorMessage}
          onRetry={handleStartScan}
          isRetrying={isStarting}
        />
      ) : isEmpty ? (
        <EmptyState onRescan={handleStartScan} isRescanning={isStarting} />
      ) : (
        <ScanningState progress={scanProgress ?? { status: "scanning", totalEmails: 0, processedEmails: 0, sendersFound: 0 }} />
      )}
    </div>
  );
}

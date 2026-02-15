/**
 * SenderScanner Component
 *
 * Provides interface for scanning Gmail for newsletter senders.
 * Shows scan progress in real-time and displays detected senders.
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Button, Progress } from "@hushletter/ui";
import {
  Search,
  Loader2,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
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
 * Idle state — prompt to start scanning
 */
function IdleState({
  onStartScan,
  isStarting,
}: {
  onStartScan: () => void;
  isStarting: boolean;
}) {
  return (
    <div className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Find your newsletters</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            We&apos;ll scan for emails with newsletter characteristics —
            unsubscribe links, known platforms, and mailing list headers.
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-border/40 pt-4">
        <Button onClick={onStartScan} disabled={isStarting} className="w-full">
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting scan...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Scan for newsletters
            </>
          )}
        </Button>
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

/**
 * Complete state — senders detected, prompt to review
 */
function CompleteState({
  senders,
  onRescan,
  isRescanning,
  onReview,
}: {
  senders: DetectedSender[];
  onRescan: () => void;
  isRescanning: boolean;
  onReview: () => void;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Found {senders.length} newsletter
            {senders.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Review and select which senders to import
          </p>
        </div>
      </div>

      {senders.length > 0 && (
        <div className="space-y-1.5">
          {senders.slice(0, 4).map((sender) => (
            <div
              key={sender._id}
              className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1 truncate text-sm">
                {sender.name || sender.email}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {sender.emailCount} emails
              </span>
            </div>
          ))}
          {senders.length > 4 && (
            <p className="py-1 text-center text-xs text-muted-foreground">
              +{senders.length - 4} more
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-border/40 pt-4">
        <Button onClick={onReview} className="flex-1">
          Review & Import
        </Button>
        <Button
          onClick={onRescan}
          disabled={isRescanning}
          variant="outline"
          size="icon-xl"
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
  );
}

type ScannerView = "scanner" | "review" | "importing";

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

  const handleStartScan = async () => {
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
  };

  if (currentView === "importing") {
    return (
      <ImportProgress
        gmailConnectionId={gmailConnectionId}
        onBack={() => setCurrentView("scanner")}
      />
    );
  }

  if (currentView === "review") {
    return (
      <SenderReview
        gmailConnectionId={gmailConnectionId}
        onBack={() => setCurrentView("scanner")}
        onStartImport={() => setCurrentView("importing")}
      />
    );
  }

  if (scanProgress === undefined) {
    return <LoadingSkeleton />;
  }

  const isScanning = scanProgress?.status === "scanning";
  const isComplete = scanProgress?.status === "complete";
  const hasError = scanProgress?.status === "error" || localError;
  const errorMessage = localError || scanProgress?.error || "An error occurred";
  const isEmpty = isComplete && (detectedSenders?.length ?? 0) === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
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
    </div>
  );
}

/**
 * ImportProgress Component
 *
 * Displays real-time import progress for historical email import.
 * Features:
 * - Progress bar with imported/total count
 * - Completion summary with imported/skipped/failed counts
 * - Error count display
 * - Progress persistence across page refresh
 */

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Link } from "@tanstack/react-router";
import { Button, Progress } from "@hushletter/ui";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  SkipForward,
  XCircle,
  ArrowRight,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

type ImportProgressData = {
  status: "pending" | "importing" | "complete" | "error";
  totalEmails: number;
  importedEmails: number;
  failedEmails: number;
  skippedEmails: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
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
      <div className="mt-4 h-2 animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * Pending state — import queued
 */
function PendingState() {
  return (
    <div className="flex items-center gap-3 p-5">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      <div>
        <p className="text-sm font-medium">Preparing import...</p>
        <p className="text-xs text-muted-foreground">
          Your import will start shortly
        </p>
      </div>
    </div>
  );
}

/**
 * Importing state — real-time progress
 */
function ImportingState({ progress }: { progress: ImportProgressData }) {
  const processedEmails =
    progress.importedEmails + progress.failedEmails + progress.skippedEmails;
  const percentage =
    progress.totalEmails > 0
      ? Math.min(
          100,
          Math.round((processedEmails / progress.totalEmails) * 100),
        )
      : 0;

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Importing newsletters...</p>
          <p className="text-xs text-muted-foreground">
            This may take a few moments depending on your email history
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress value={percentage} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {processedEmails} of {progress.totalEmails} emails
          </span>
          <span>{percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-lg font-semibold">
              {progress.importedEmails}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Imported</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <SkipForward className="h-3.5 w-3.5" />
            <span className="text-lg font-semibold">
              {progress.skippedEmails}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Skipped</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-red-500">
            <XCircle className="h-3.5 w-3.5" />
            <span className="text-lg font-semibold">
              {progress.failedEmails}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Failed</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Complete state — import finished
 */
function CompleteState({ progress }: { progress: ImportProgressData }) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">Import complete</p>
          <p className="text-xs text-muted-foreground">
            Successfully imported {progress.importedEmails} newsletter
            {progress.importedEmails !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Imported
          </div>
          <span className="text-sm font-medium">
            {progress.importedEmails}
          </span>
        </div>

        {progress.skippedEmails > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SkipForward className="h-4 w-4" />
              Skipped (duplicates)
            </div>
            <span className="text-sm text-muted-foreground">
              {progress.skippedEmails}
            </span>
          </div>
        )}

        {progress.failedEmails > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              Failed
            </div>
            <span className="text-sm text-red-600 dark:text-red-400">
              {progress.failedEmails}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 pt-4">
        <Button
          render={<Link to="/newsletters" />}
          className="w-full"
        >
          <Mail className="mr-2 h-4 w-4" />
          View newsletters
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Error state — import failed
 */
function ErrorState({
  progress,
  onRetry,
  isRetrying,
}: {
  progress: ImportProgressData;
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
            Import failed
          </p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/80">
            {progress.error || "An unexpected error occurred"}
          </p>
        </div>
      </div>

      {progress.importedEmails > 0 && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {progress.importedEmails} email
          {progress.importedEmails !== 1 ? "s were" : " was"} imported before
          the error.
        </p>
      )}

      <div className="flex gap-2.5">
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
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </>
          )}
        </Button>
        {progress.importedEmails > 0 && (
          <Button
            render={<Link to="/newsletters" />}
            className="flex-1"
          >
            View imported
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * ImportProgress — shows real-time import progress
 */
export function ImportProgress({
  gmailConnectionId,
  onBack,
}: {
  gmailConnectionId: Id<"gmailConnections">;
  onBack?: () => void;
}) {
  const importProgress = useQuery(api.gmail.getImportProgress, {
    gmailConnectionId,
  }) as ImportProgressData | null | undefined;

  const startImport = useAction(api.gmail.startHistoricalImport);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await startImport({ gmailConnectionId });
    } catch (error) {
      console.error("[ImportProgress] Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  if (importProgress === undefined) {
    return <LoadingSkeleton />;
  }

  if (!importProgress) {
    return null;
  }

  const { status } = importProgress;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {status === "pending" && <PendingState />}
      {status === "importing" && <ImportingState progress={importProgress} />}
      {status === "complete" && <CompleteState progress={importProgress} />}
      {status === "error" && (
        <ErrorState
          progress={importProgress}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {onBack && status !== "importing" && (
        <div className="border-t border-border/40 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to scan
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * SenderReview Component
 *
 * Provides interface for reviewing and selecting detected senders for import.
 * Features:
 * - Individual sender selection with checkboxes
 * - Select All / Deselect All controls
 * - Expandable sender details
 * - Import trigger flow
 * - Optimistic updates for instant selection feedback
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@hushletter/backend";
import {
  Badge,
  Button,
  Checkbox,
} from "@hushletter/ui";
import {
  ChevronDown,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

type DetectedSender = {
  _id: string;
  email: string;
  name?: string;
  domain: string;
  emailCount: number;
  confidenceScore: number;
  sampleSubjects: string[];
  detectedAt: number;
  isSelected: boolean;
  isApproved: boolean;
};

function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Individual sender row with checkbox and expandable details
 */
function SenderRow({
  sender,
  optimisticSelected,
  onSelectionChange,
}: {
  sender: DetectedSender;
  optimisticSelected?: boolean;
  onSelectionChange: (isSelected: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = optimisticSelected ?? sender.isSelected;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        !isSelected && "opacity-60 bg-muted/30 border-border/40",
        isSelected && "bg-card border-border/60",
      )}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`${sender.name || sender.email}, ${sender.emailCount} emails`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange(checked === true)}
            aria-label={`Select ${sender.name || sender.email}`}
          />
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {sender.name || sender.email}
          </p>
          {sender.name && (
            <p className="truncate text-xs text-muted-foreground">
              {sender.email}
            </p>
          )}
        </div>

        <span className="shrink-0 text-xs text-muted-foreground">
          {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""}
        </span>

        <Badge
          variant={sender.confidenceScore >= 50 ? "default" : "secondary"}
          className="shrink-0"
        >
          {sender.confidenceScore}%
        </Badge>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </div>

      {isExpanded && (
        <div className="space-y-2.5 border-t border-border/40 px-3 pb-3 pl-14 pt-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Domain
              </span>
              <p className="text-xs">{sender.domain}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Confidence
              </span>
              <p className="text-xs">
                {sender.confidenceScore >= 80
                  ? "High"
                  : sender.confidenceScore >= 50
                    ? "Medium"
                    : "Low"}{" "}
                ({sender.confidenceScore}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Detected {formatDate(sender.detectedAt)}
          </div>

          {sender.sampleSubjects.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Sample subjects
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {sender.sampleSubjects.slice(0, 3).map((subject, i) => (
                  <li
                    key={i}
                    className="truncate text-xs text-muted-foreground"
                  >
                    {subject}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      <span className="flex-1 text-xs text-red-700 dark:text-red-300">
        {message}
      </span>
      <button
        onClick={onDismiss}
        className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * Confirm import step
 */
function ConfirmImportView({
  selectedCount,
  onConfirm,
  onCancel,
  isApproving,
}: {
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isApproving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Confirm import</p>
          <p className="text-xs text-muted-foreground">
            Import newsletters from {selectedCount} sender
            {selectedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        We&apos;ll start importing historical emails from the selected senders.
        This may take some time depending on the number of emails.
      </p>

      <div className="flex gap-2.5">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isApproving}
          className="flex-1"
        >
          Go back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isApproving}
          className="flex-1"
        >
          {isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Success view — senders approved, trigger import
 */
function ApprovalSuccessView({
  approvedCount,
  onStartImport,
  isStartingImport,
  importError,
}: {
  approvedCount: number;
  onStartImport: () => void;
  isStartingImport: boolean;
  importError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">Senders approved</p>
          <p className="text-xs text-muted-foreground">
            {approvedCount} sender{approvedCount !== 1 ? "s" : ""} ready for
            import
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Start importing historical emails from your approved senders.
      </p>

      {importError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {importError}
        </p>
      )}

      <Button
        onClick={onStartImport}
        disabled={isStartingImport}
        className="w-full"
      >
        {isStartingImport ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting import...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Start import
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * SenderReview — review and select senders for import
 */
export function SenderReview({
  gmailConnectionId,
  onBack,
  onStartImport,
}: {
  gmailConnectionId: Id<"gmailConnections">;
  onBack?: () => void;
  onStartImport?: () => void;
}) {
  const [view, setView] = useState<"review" | "confirm" | "success">("review");
  const [approvedCount, setApprovedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, boolean>
  >(new Map());

  const detectedSenders = useQuery(api.gmail.getDetectedSenders, {
    gmailConnectionId,
  }) as DetectedSender[] | undefined;
  const senderCounts = useQuery(api.gmail.getSelectedSendersCount);

  const updateSelection = useMutation(api.gmail.updateSenderSelection);
  const selectAll = useMutation(api.gmail.selectAllSenders);
  const deselectAll = useMutation(api.gmail.deselectAllSenders);
  const approveSelected = useMutation(api.gmail.approveSelectedSenders);
  const startHistoricalImport = useAction(api.gmail.startHistoricalImport);

  const { selectedCount, totalCount } = useMemo(() => {
    if (!detectedSenders) {
      return {
        selectedCount: senderCounts?.selectedCount ?? 0,
        totalCount: senderCounts?.totalCount ?? 0,
      };
    }

    if (optimisticUpdates.size > 0) {
      const optimisticCount = detectedSenders.filter((sender) => {
        const optimistic = optimisticUpdates.get(sender._id);
        return optimistic ?? sender.isSelected;
      }).length;
      return { selectedCount: optimisticCount, totalCount: detectedSenders.length };
    }

    return {
      selectedCount: senderCounts?.selectedCount ?? 0,
      totalCount: senderCounts?.totalCount ?? 0,
    };
  }, [detectedSenders, senderCounts, optimisticUpdates]);

  const handleSelectionChange = useCallback(
    async (senderId: string, isSelected: boolean) => {
      setError(null);
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(senderId, isSelected);
        return next;
      });

      try {
        await updateSelection({
          senderId: senderId as Parameters<typeof updateSelection>[0]["senderId"],
          isSelected,
        });
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(senderId);
          return next;
        });
      } catch (err) {
        console.error("[SenderReview] Failed to update selection:", err);
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(senderId);
          return next;
        });
        setError("Failed to update selection. Please try again.");
      }
    },
    [updateSelection],
  );

  const handleSelectAll = useCallback(async () => {
    setError(null);
    if (detectedSenders) {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        for (const sender of detectedSenders) {
          next.set(sender._id, true);
        }
        return next;
      });
    }

    try {
      await selectAll();
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to select all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to select all senders. Please try again.");
    }
  }, [selectAll, detectedSenders]);

  const handleDeselectAll = useCallback(async () => {
    setError(null);
    if (detectedSenders) {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        for (const sender of detectedSenders) {
          next.set(sender._id, false);
        }
        return next;
      });
    }

    try {
      await deselectAll();
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to deselect all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to deselect all senders. Please try again.");
    }
  }, [deselectAll, detectedSenders]);

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    setError(null);
    try {
      const result = await approveSelected();
      setApprovedCount(result.approvedCount);
      setView("success");
    } catch (err) {
      console.error("[SenderReview] Failed to approve senders:", err);
      setError("Failed to approve senders. Please try again.");
    } finally {
      setIsApproving(false);
    }
  }, [approveSelected]);

  const handleStartImport = useCallback(async () => {
    setIsStartingImport(true);
    setImportError(null);
    try {
      const result = await startHistoricalImport({ gmailConnectionId });
      if (result.success) {
        onStartImport?.();
      } else {
        setImportError(result.error || "Failed to start import.");
      }
    } catch (err) {
      console.error("[SenderReview] Failed to start import:", err);
      setImportError("Failed to start import. Please try again.");
    } finally {
      setIsStartingImport(false);
    }
  }, [startHistoricalImport, gmailConnectionId, onStartImport]);

  if (detectedSenders === undefined) {
    return <LoadingSkeleton />;
  }

  if (detectedSenders.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No senders to review</p>
            <p className="text-xs text-muted-foreground">
              Scan your Gmail first to detect newsletter senders.
            </p>
          </div>
        </div>
        {onBack && (
          <div className="mt-4 border-t border-border/40 pt-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to scan
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Review senders</h3>
            <p
              className="mt-0.5 text-xs text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {view === "review"
                ? `${selectedCount} of ${totalCount} selected`
                : view === "confirm"
                  ? "Confirm your selection"
                  : "Approval complete"}
            </p>
          </div>
          {view === "review" && (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={selectedCount === totalCount}
                className="h-7 px-2 text-xs"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                disabled={selectedCount === 0}
                className="h-7 px-2 text-xs"
              >
                Deselect all
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        {view === "review" && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {detectedSenders.map((sender) => (
              <SenderRow
                key={sender._id}
                sender={sender}
                optimisticSelected={optimisticUpdates.get(sender._id)}
                onSelectionChange={(isSelected) =>
                  handleSelectionChange(sender._id, isSelected)
                }
              />
            ))}
          </div>
        )}

        {view === "confirm" && (
          <ConfirmImportView
            selectedCount={selectedCount}
            onConfirm={handleApprove}
            onCancel={() => setView("review")}
            isApproving={isApproving}
          />
        )}

        {view === "success" && (
          <ApprovalSuccessView
            approvedCount={approvedCount}
            onStartImport={handleStartImport}
            isStartingImport={isStartingImport}
            importError={importError}
          />
        )}
      </div>

      {/* Footer */}
      {view === "review" && (
        <div className="flex items-center gap-2.5 border-t border-border/40 px-5 py-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={() => setView("confirm")}
            disabled={selectedCount === 0}
            size="sm"
          >
            Import {selectedCount} sender{selectedCount !== 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

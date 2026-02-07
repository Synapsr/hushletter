/**
 * SenderReview Component
 * Story 4.3: Sender Review & Approval
 *
 * Provides interface for reviewing and selecting detected senders for import.
 * Features:
 * - Individual sender selection with checkboxes (AC#1)
 * - Select All / Deselect All controls (AC#2)
 * - Expandable sender details (AC#3)
 * - Import trigger flow (AC#4)
 * - Visual feedback for selection state (AC#5)
 *
 * Code Review Fixes Applied:
 * - Optimistic updates for instant selection feedback (performance improvement)
 * - Inline error display instead of silent console.error
 * - aria-live region for screen reader announcements
 * - Added detected date information (partial AC#3 fix - full date range requires schema changes)
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@hushletter/backend";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Mail, Loader2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Types for detected senders
 */
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

/**
 * Loading skeleton for the component
 * Story 4.3: Task 2 - Loading state
 */
function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Individual sender row with checkbox and expandable details
 * Story 4.3: Task 2 & Task 4 (AC#1, #3, #5)
 *
 * Uses optimistic selection for instant feedback
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

  // Use optimistic value if available, otherwise use server state
  const isSelected = optimisticSelected ?? sender.isSelected;

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        !isSelected && "opacity-60 bg-muted/50",
        isSelected && "bg-card",
      )}
    >
      {/* Main row - clickable to expand */}
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
        aria-label={`${sender.name || sender.email}, ${sender.emailCount} emails. Click to ${isExpanded ? "collapse" : "expand"} details.`}
      >
        {/* Checkbox - AC#1 */}
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange(checked === true)}
            aria-label={`Select ${sender.name || sender.email} for import`}
          />
        </div>

        {/* Sender icon */}
        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Sender info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{sender.name || sender.email}</p>
          {sender.name && <p className="text-sm text-muted-foreground truncate">{sender.email}</p>}
        </div>

        {/* Email count */}
        <div className="text-sm text-muted-foreground flex-shrink-0">
          {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""}
        </div>

        {/* Confidence badge */}
        <Badge
          variant={sender.confidenceScore >= 50 ? "default" : "secondary"}
          className="flex-shrink-0"
        >
          {sender.confidenceScore}%
        </Badge>

        {/* Expand icon */}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
            isExpanded && "rotate-180",
          )}
        />
      </div>

      {/* Expandable detail section - AC#3 */}
      {isExpanded && (
        <div className="px-3 pb-3 pl-16 space-y-3 text-sm border-t">
          <div className="pt-3 grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-muted-foreground">Domain:</span>{" "}
              <span>{sender.domain}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Confidence:</span>{" "}
              <Badge variant={sender.confidenceScore >= 50 ? "default" : "secondary"}>
                {sender.confidenceScore >= 80
                  ? "High"
                  : sender.confidenceScore >= 50
                    ? "Medium"
                    : "Low"}{" "}
                ({sender.confidenceScore}%)
              </Badge>
            </div>
          </div>

          {/* Detected date - partial AC#3 fix (full date range requires schema changes) */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Detected:</span>{" "}
            <span>{formatDate(sender.detectedAt)}</span>
          </div>

          {sender.sampleSubjects.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Sample subjects:</p>
              <ul className="list-disc pl-4 space-y-1">
                {sender.sampleSubjects.slice(0, 3).map((subject, i) => (
                  <li key={i} className="truncate text-muted-foreground">
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

/**
 * Inline error alert component
 */
function ErrorAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900"
    >
      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm font-medium"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * Confirmation dialog content
 * Story 4.3: Task 5.5 - Show confirmation before starting import
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
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="font-medium text-blue-800 dark:text-blue-200">Confirm Import</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            You&apos;re about to import newsletters from {selectedCount} sender
            {selectedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        After confirmation, we&apos;ll start importing historical emails from the selected senders.
        This may take some time depending on the number of emails.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isApproving} className="flex-1">
          Go Back
        </Button>
        <Button onClick={onConfirm} disabled={isApproving} className="flex-1">
          {isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Success view after approval - starts import automatically
 * Story 4.3: Task 5.4 - Transition to import progress view
 * Story 4.4: Task 7.2 - Start import after approval
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
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">Senders Approved!</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            {approvedCount} sender{approvedCount !== 1 ? "s" : ""} ready for import
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Click the button below to start importing historical emails from your approved senders. This
        may take a few minutes depending on the number of emails.
      </p>

      {importError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
          <p className="text-sm text-red-700 dark:text-red-300">{importError}</p>
        </div>
      )}

      <Button onClick={onStartImport} disabled={isStartingImport} className="w-full">
        {isStartingImport ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Import...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Start Import
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * SenderReview - Main component for reviewing and selecting senders
 * Story 4.3: All Tasks and ACs
 * Story 4.4: Task 7.1, 7.2 - Integrate import flow after approval
 *
 * Uses optimistic updates for instant selection feedback without lag
 */
export function SenderReview({
  onBack,
  onStartImport,
}: {
  onBack?: () => void;
  onStartImport?: () => void;
}) {
  // State for view management
  const [view, setView] = useState<"review" | "confirm" | "success">("review");
  const [approvedCount, setApprovedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Optimistic updates map for instant feedback
  // Key: senderId, Value: optimistic isSelected state
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, boolean>>(new Map());

  // Queries
  const detectedSenders = useQuery(api.gmail.getDetectedSenders) as DetectedSender[] | undefined;
  const senderCounts = useQuery(api.gmail.getSelectedSendersCount);

  // Mutations
  const updateSelection = useMutation(api.gmail.updateSenderSelection);
  const selectAll = useMutation(api.gmail.selectAllSenders);
  const deselectAll = useMutation(api.gmail.deselectAllSenders);
  const approveSelected = useMutation(api.gmail.approveSelectedSenders);

  // Action for starting import (Story 4.4)
  const startHistoricalImport = useAction(api.gmail.startHistoricalImport);

  // Calculate optimistic counts
  const { selectedCount, totalCount } = useMemo(() => {
    if (!detectedSenders) {
      return {
        selectedCount: senderCounts?.selectedCount ?? 0,
        totalCount: senderCounts?.totalCount ?? 0,
      };
    }

    // If we have optimistic updates, calculate counts including them
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

  // Handle individual selection change with optimistic update
  const handleSelectionChange = useCallback(
    async (senderId: string, isSelected: boolean) => {
      // Clear any previous error
      setError(null);

      // Apply optimistic update immediately for instant feedback
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
        // Success - clear optimistic state, server state will take over via query subscription
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(senderId);
          return next;
        });
      } catch (err) {
        console.error("[SenderReview] Failed to update selection:", err);
        // Revert optimistic update on failure
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

  // Handle select all - AC#2
  const handleSelectAll = useCallback(async () => {
    setError(null);
    // Apply optimistic update for all senders
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
      // Clear all optimistic updates
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to select all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to select all senders. Please try again.");
    }
  }, [selectAll, detectedSenders]);

  // Handle deselect all - AC#2
  const handleDeselectAll = useCallback(async () => {
    setError(null);
    // Apply optimistic update for all senders
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
      // Clear all optimistic updates
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to deselect all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to deselect all senders. Please try again.");
    }
  }, [deselectAll, detectedSenders]);

  // Handle approve selected - AC#4
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

  // Handle start import - Story 4.4: Task 7.2
  const handleStartImport = useCallback(async () => {
    setIsStartingImport(true);
    setImportError(null);
    try {
      const result = await startHistoricalImport();
      if (result.success) {
        // Notify parent to show import progress
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
  }, [startHistoricalImport, onStartImport]);

  // Show loading skeleton while fetching
  if (detectedSenders === undefined) {
    return <LoadingSkeleton />;
  }

  // No senders to review
  if (detectedSenders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            No Senders to Review
          </CardTitle>
          <CardDescription>
            No newsletter senders have been detected yet. Please scan your Gmail first.
          </CardDescription>
        </CardHeader>
        {onBack && (
          <CardFooter>
            <Button variant="outline" onClick={onBack}>
              Go Back
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Review Detected Senders
        </CardTitle>
        {/* aria-live for screen reader announcements of count changes */}
        <CardDescription aria-live="polite" aria-atomic="true">
          {view === "review"
            ? `${selectedCount} of ${totalCount} sender${totalCount !== 1 ? "s" : ""} selected for import`
            : view === "confirm"
              ? "Confirm your selection to proceed with import"
              : "Import approval complete"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Error display */}
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        {view === "review" && (
          <div className="space-y-4">
            {/* Selection controls - AC#2 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={selectedCount === totalCount}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={selectedCount === 0}
              >
                Deselect All
              </Button>
            </div>

            {/* Sender list - AC#1, #3, #5 */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {detectedSenders.map((sender) => (
                <SenderRow
                  key={sender._id}
                  sender={sender}
                  optimisticSelected={optimisticUpdates.get(sender._id)}
                  onSelectionChange={(isSelected) => handleSelectionChange(sender._id, isSelected)}
                />
              ))}
            </div>
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
      </CardContent>

      {view === "review" && (
        <CardFooter className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            onClick={() => setView("confirm")}
            disabled={selectedCount === 0}
            className="flex-1"
          >
            Import {selectedCount} Sender{selectedCount !== 1 ? "s" : ""}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

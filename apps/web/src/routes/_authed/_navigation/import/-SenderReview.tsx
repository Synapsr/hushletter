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

import { useState, useCallback, useMemo, useEffect } from "react";
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

type GmailImportPreviewStatus = {
  isPro: boolean;
  senderCap: number;
  emailCap: number;
  importedSenders: number;
  importedEmails: number;
  remainingSenders: number;
  remainingEmails: number;
  importedSenderEmails: string[];
};

type StartImportResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode?: "FREE_PREVIEW_SENDER_LIMIT" | "FREE_PREVIEW_EMAIL_LIMIT";
    };

function normalizeSenderEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getConvexErrorDetails(error: unknown): {
  message?: string;
  code?: string;
} {
  if (typeof error !== "object" || error === null) {
    return {};
  }
  const maybeData = (error as { data?: { message?: string; code?: string } })
    .data;
  return {
    message: maybeData?.message,
    code: maybeData?.code,
  };
}

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
  selectionDisabled,
  selectionDisabledReason,
  onSelectionChange,
}: {
  sender: DetectedSender;
  optimisticSelected?: boolean;
  selectionDisabled?: boolean;
  selectionDisabledReason?: string;
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
            disabled={selectionDisabled}
            onCheckedChange={(checked) => onSelectionChange(checked === true)}
            aria-label={`Select ${sender.name || sender.email}`}
            title={selectionDisabledReason}
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
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingSelection, setIsUpdatingSelection] = useState(false);
  const [hasAutoNormalizedSelection, setHasAutoNormalizedSelection] =
    useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, boolean>
  >(new Map());

  const detectedSenders = useQuery(api.gmail.getDetectedSenders, {
    gmailConnectionId,
  }) as DetectedSender[] | undefined;
  const senderCounts = useQuery(api.gmail.getSelectedSendersCount);
  const previewStatus = useQuery(
    api.gmail.getGmailImportPreviewStatus,
  ) as GmailImportPreviewStatus | undefined;

  const updateSelection = useMutation(api.gmail.updateSenderSelection);
  const setExclusiveSelection = useMutation(api.gmail.setExclusiveSenderSelection);
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

  const isFreePreview = previewStatus ? !previewStatus.isPro : false;
  const importedSenderEmailSet = useMemo(
    () =>
      new Set(
        (previewStatus?.importedSenderEmails ?? []).map((email) =>
          normalizeSenderEmail(email),
        ),
      ),
    [previewStatus?.importedSenderEmails],
  );
  const remainingSenderSlots = previewStatus?.remainingSenders ?? 0;
  const remainingEmailSlots = previewStatus?.remainingEmails ?? 0;

  const getEffectiveSelected = useCallback(
    (sender: DetectedSender) => {
      return optimisticUpdates.get(sender._id) ?? sender.isSelected;
    },
    [optimisticUpdates],
  );

  const isSenderImportedBefore = useCallback(
    (sender: DetectedSender) =>
      importedSenderEmailSet.has(normalizeSenderEmail(sender.email)),
    [importedSenderEmailSet],
  );

  const selectedNewSenderCount = useMemo(() => {
    if (!detectedSenders || !isFreePreview) return 0;
    return detectedSenders.filter((sender) => {
      if (isSenderImportedBefore(sender)) return false;
      return getEffectiveSelected(sender);
    }).length;
  }, [
    detectedSenders,
    getEffectiveSelected,
    isFreePreview,
    isSenderImportedBefore,
  ]);
  const isSelectionOverFreeSenderLimit =
    isFreePreview && selectedNewSenderCount > remainingSenderSlots;
  const isEmailPreviewExhausted =
    isFreePreview && previewStatus !== undefined && remainingEmailSlots <= 0;

  useEffect(() => {
    if (!isFreePreview || !detectedSenders || hasAutoNormalizedSelection) {
      return;
    }

    const selectedSenders = detectedSenders.filter(getEffectiveSelected);
    if (selectedSenders.length <= 1) {
      setHasAutoNormalizedSelection(true);
      return;
    }

    const senderToKeep =
      selectedSenders.find(isSenderImportedBefore) ?? selectedSenders[0];
    setHasAutoNormalizedSelection(true);

    setOptimisticUpdates(() => {
      const next = new Map<string, boolean>();
      for (const sender of detectedSenders) {
        next.set(sender._id, sender._id === senderToKeep._id);
      }
      return next;
    });

    void (async () => {
      setIsUpdatingSelection(true);
      try {
        await setExclusiveSelection({
          senderId:
            senderToKeep._id as Parameters<typeof setExclusiveSelection>[0]["senderId"],
        });
      } catch (err) {
        console.error("[SenderReview] Failed to normalize free selection:", err);
        setError(
          "We could not apply free preview selection limits automatically. Please select one sender.",
        );
      } finally {
        setOptimisticUpdates(new Map());
        setIsUpdatingSelection(false);
      }
    })();
  }, [
    detectedSenders,
    getEffectiveSelected,
    hasAutoNormalizedSelection,
    isFreePreview,
    isSenderImportedBefore,
    setExclusiveSelection,
  ]);

  const handleSelectionChange = useCallback(
    async (senderId: string, isSelected: boolean) => {
      if (isUpdatingSelection) return;
      setError(null);

      const sender = detectedSenders?.find((item) => item._id === senderId);
      if (!sender) return;

      if (isSelected && isFreePreview && detectedSenders) {
        if (!isSenderImportedBefore(sender) && remainingSenderSlots <= 0) {
          setError(
            "Free preview includes Gmail imports from 1 sender lifetime. Upgrade to Pro to import from additional senders.",
          );
          return;
        }

        setOptimisticUpdates(() => {
          const next = new Map<string, boolean>();
          for (const candidate of detectedSenders) {
            next.set(candidate._id, candidate._id === senderId);
          }
          return next;
        });

        setIsUpdatingSelection(true);
        try {
          await setExclusiveSelection({
            senderId:
              senderId as Parameters<typeof setExclusiveSelection>[0]["senderId"],
          });
          setOptimisticUpdates(new Map());
        } catch (err) {
          console.error("[SenderReview] Failed to update selection:", err);
          setOptimisticUpdates(new Map());
          setError("Failed to update selection. Please try again.");
        } finally {
          setIsUpdatingSelection(false);
        }
        return;
      }

      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(senderId, isSelected);
        return next;
      });

      setIsUpdatingSelection(true);
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
      } finally {
        setIsUpdatingSelection(false);
      }
    },
    [
      detectedSenders,
      isFreePreview,
      isSenderImportedBefore,
      isUpdatingSelection,
      remainingSenderSlots,
      setExclusiveSelection,
      updateSelection,
    ],
  );

  const handleSelectAll = useCallback(async () => {
    setError(null);
    if (isFreePreview) {
      setError(
        "Free preview supports one sender lifetime. Select a single sender to continue, or upgrade to Pro.",
      );
      return;
    }
    if (detectedSenders) {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        for (const sender of detectedSenders) {
          next.set(sender._id, true);
        }
        return next;
      });
    }

    setIsUpdatingSelection(true);
    try {
      await selectAll();
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to select all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to select all senders. Please try again.");
    } finally {
      setIsUpdatingSelection(false);
    }
  }, [detectedSenders, isFreePreview, selectAll]);

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

    setIsUpdatingSelection(true);
    try {
      await deselectAll();
      setOptimisticUpdates(new Map());
    } catch (err) {
      console.error("[SenderReview] Failed to deselect all:", err);
      setOptimisticUpdates(new Map());
      setError("Failed to deselect all senders. Please try again.");
    } finally {
      setIsUpdatingSelection(false);
    }
  }, [deselectAll, detectedSenders]);

  const handleImport = useCallback(async () => {
    if (isFreePreview && selectedNewSenderCount > remainingSenderSlots) {
      setError(
        "Free preview includes Gmail imports from 1 sender lifetime. Deselect extra senders or upgrade to Pro.",
      );
      return;
    }
    if (isFreePreview && remainingEmailSlots <= 0) {
      setError(
        "Free preview limit reached: you can import up to 25 Gmail emails lifetime. Upgrade to Pro for unlimited imports.",
      );
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      await approveSelected();
    } catch (err) {
      console.error("[SenderReview] Failed to approve senders:", err);
      const details = getConvexErrorDetails(err);
      if (details.code === "FREE_PREVIEW_SENDER_LIMIT") {
        setError(
          "Free preview includes Gmail imports from 1 sender lifetime. Deselect extra senders or upgrade to Pro.",
        );
      } else {
        setError(details.message || "Failed to approve senders. Please try again.");
      }
      setIsImporting(false);
      return;
    }

    try {
      const result = (await startHistoricalImport({
        gmailConnectionId,
      })) as StartImportResult;
      if (result.success) {
        onStartImport?.();
      } else {
        if (result.errorCode === "FREE_PREVIEW_SENDER_LIMIT") {
          setError(
            "Free preview includes Gmail imports from 1 sender lifetime. Deselect extra senders or upgrade to Pro.",
          );
        } else if (result.errorCode === "FREE_PREVIEW_EMAIL_LIMIT") {
          setError(
            "Free preview limit reached: you can import up to 25 Gmail emails lifetime. Upgrade to Pro for unlimited imports.",
          );
        } else {
          setError(result.error || "Failed to start import.");
        }
      }
    } catch (err) {
      console.error("[SenderReview] Failed to start import:", err);
      const details = getConvexErrorDetails(err);
      setError(details.message || "Failed to start import. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }, [
    approveSelected,
    gmailConnectionId,
    isFreePreview,
    onStartImport,
    remainingEmailSlots,
    remainingSenderSlots,
    selectedNewSenderCount,
    startHistoricalImport,
  ]);

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
              {selectedCount} of {totalCount} selected
            </p>
            {isFreePreview && previewStatus && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                Free preview remaining: {remainingSenderSlots} sender slot
                {remainingSenderSlots !== 1 ? "s" : ""}, {remainingEmailSlots}{" "}
                email{remainingEmailSlots !== 1 ? "s" : ""} lifetime
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={
                selectedCount === totalCount || isFreePreview || isUpdatingSelection || isImporting
              }
              className="h-7 px-2 text-xs"
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              disabled={selectedCount === 0 || isUpdatingSelection || isImporting}
              className="h-7 px-2 text-xs"
            >
              Deselect all
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
        {isSelectionOverFreeSenderLimit && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Free preview includes Gmail imports from 1 sender lifetime. Deselect
            extra senders or upgrade to Pro.
          </p>
        )}
        {isEmailPreviewExhausted && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            You&apos;ve used your free Gmail preview (25 emails lifetime). Upgrade
            to Pro for unlimited imports.
          </p>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {detectedSenders.map((sender) => {
            const isSelected = getEffectiveSelected(sender);
            const isImportedSender = isSenderImportedBefore(sender);
            const disableNewSelection =
              isFreePreview &&
              !isImportedSender &&
              !isSelected &&
              remainingSenderSlots <= 0;
            const selectionDisabled = disableNewSelection || isUpdatingSelection || isImporting;

            return (
              <SenderRow
                key={sender._id}
                sender={sender}
                optimisticSelected={optimisticUpdates.get(sender._id)}
                selectionDisabled={selectionDisabled}
                selectionDisabledReason={
                  disableNewSelection
                    ? "Free preview supports 1 sender lifetime. Upgrade to Pro to import more senders."
                    : isUpdatingSelection
                      ? "Updating selection..."
                    : undefined
                }
                onSelectionChange={(isSelected) =>
                  handleSelectionChange(sender._id, isSelected)
                }
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2.5 border-t border-border/40 px-5 py-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={isImporting} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={handleImport}
          disabled={
            selectedCount === 0 ||
            isSelectionOverFreeSenderLimit ||
            isEmailPreviewExhausted ||
            isUpdatingSelection ||
            isImporting
          }
          size="sm"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>Import {selectedCount} sender{selectedCount !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}

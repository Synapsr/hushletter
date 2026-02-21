/**
 * BulkImportProgress Component
 * Story 8.2: Task 4 (AC #4, #5)
 * Story 8.4: Task 4 (AC #6) - Duplicate tracking
 *
 * Processes multiple .eml files with concurrency control and progress tracking.
 * Features:
 * - Parallel processing with concurrency limit (3 concurrent)
 * - Real-time progress tracking
 * - Individual file status display
 * - Summary with imported/duplicates/failed counts (AC #6)
 * - Expandable failure details
 */

import { useState, useEffect, useRef } from "react";
import { parseEmlFile, type ParsedEml, type EmlParseResult } from "@hushletter/shared";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Link } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
} from "@hushletter/ui";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  Mail,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { readFileAsArrayBuffer, getParserErrorMessage } from "./emlUtils";
import { m } from "@/paraglide/messages.js";

interface BulkImportProgressProps {
  /** Files to import */
  files: File[];
  /** Callback when import completes */
  onComplete: () => void;
  /** Callback to cancel/go back */
  onCancel: () => void;
}

/** Result of processing a single file */
interface FileImportResult {
  filename: string;
  status: "importing" | "success" | "duplicate" | "skipped" | "error";
  error?: string;
  userNewsletterId?: string;
  /** Story 8.4: Duplicate detection reason (when status is "duplicate") */
  duplicateReason?: "message_id" | "content_hash";
}

/** Concurrency limit for parallel processing */
const CONCURRENCY_LIMIT = 3;

/**
 * Individual file status row
 * Story 8.4: Added duplicate status display
 */
function FileStatusRow({ result }: { result: FileImportResult }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
      {result.status === "importing" && (
        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
      )}
      {result.status === "success" && (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
      )}
      {result.status === "duplicate" && (
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
      )}
      {result.status === "skipped" && (
        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
      )}
      {result.status === "error" && (
        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
      )}
      <span className="text-sm truncate flex-1">{result.filename}</span>
      {result.status === "duplicate" && (
        <span className="text-xs text-yellow-600 dark:text-yellow-400">{m.bulkProgress_duplicateStatus()}</span>
      )}
    </div>
  );
}

/**
 * Bulk import progress component with concurrency control
 */
export function BulkImportProgress({ files, onComplete, onCancel }: BulkImportProgressProps) {
  const [results, setResults] = useState<FileImportResult[]>(
    files.map((f) => ({ filename: f.name, status: "importing" as const })),
  );
  const [isProcessing, setIsProcessing] = useState(true);
  const [showFailures, setShowFailures] = useState(false);

  const importAction = useAction(api.manualImport.importEmlNewsletter);
  const importActionRef = useRef(importAction);

  useEffect(() => {
    importActionRef.current = importAction;
  }, [importAction]);

  // Calculate counts
  // Story 8.4: Add duplicate count, separate from skipped (parse errors)
  const imported = results.filter((r) => r.status === "success").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;
  const processed = imported + duplicates + skipped + failed;
  const percentage = Math.round((processed / files.length) * 100);

  // Process files with concurrency limit
  useEffect(() => {
    let isCancelled = false;

    setResults(files.map((f) => ({ filename: f.name, status: "importing" as const })));
    setIsProcessing(true);
    setShowFailures(false);

    const processFiles = async () => {
      // Queue file entries with stable indices. Using names as keys can collide.
      const queue = files.map((file, index) => ({ file, index }));

      const processNext = async (): Promise<void> => {
        while (!isCancelled) {
          // Thread-safe: shift() removes and returns first element atomically
          const next = queue.shift();
          if (!next) return;
          const { file, index: fileIndex } = next;

          try {
            // 1. Parse the file client-side
            const buffer = await readFileAsArrayBuffer(file);
            const parseResult: EmlParseResult = await parseEmlFile(buffer);

            if (isCancelled) return;

            if (!parseResult.success) {
              // Parser error
              setResults((prev) =>
                prev.map((r, i) =>
                  i === fileIndex
                    ? {
                        ...r,
                        status: "error",
                        error: getParserErrorMessage(parseResult.error.code),
                      }
                    : r,
                ),
              );
              continue;
            }

            const parsed: ParsedEml = parseResult.data;

            // 2. Import via Convex action
            const result = await importActionRef.current({
              subject: parsed.subject,
              senderEmail: parsed.senderEmail,
              senderName: parsed.senderName ?? undefined,
              receivedAt: parsed.receivedAt,
              htmlContent: parsed.htmlContent ?? undefined,
              textContent: parsed.textContent ?? undefined,
              messageId: parsed.messageId ?? undefined,
            });

            if (isCancelled) return;

            // 3. Handle server-side skips (duplicates, plan limit, etc.)
            if (result.skipped) {
              if (result.reason === "duplicate") {
                setResults((prev) =>
                  prev.map((r, i) =>
                    i === fileIndex
                      ? {
                          ...r,
                          status: "duplicate",
                          duplicateReason: result.duplicateReason,
                          userNewsletterId: result.existingId,
                        }
                      : r,
                  ),
                );
              } else {
                // Plan limit reached (Free hard cap / unlock cap)
                setResults((prev) =>
                  prev.map((r, i) =>
                    i === fileIndex
                      ? {
                          ...r,
                          status: "skipped",
                          error: `Plan limit reached (cap: ${result.hardCap}).`,
                        }
                      : r,
                  ),
                );
              }
              continue;
            }

            // 4. Mark as success
            setResults((prev) =>
              prev.map((r, i) =>
                i === fileIndex
                  ? {
                      ...r,
                      status: "success",
                      userNewsletterId: result.userNewsletterId,
                    }
                  : r,
              ),
            );
          } catch (error) {
            if (isCancelled) return;

            // Import error
            const errorMessage =
              error instanceof Error ? error.message : "Failed to import newsletter";

            setResults((prev) =>
              prev.map((r, i) =>
                i === fileIndex
                  ? {
                      ...r,
                      status: "error",
                      error: errorMessage,
                    }
                  : r,
              ),
            );
          }
        }
      };

      // Start concurrent workers
      await Promise.all(
        Array(Math.min(CONCURRENCY_LIMIT, files.length))
          .fill(null)
          .map(() => processNext()),
      );

      if (!isCancelled) {
        setIsProcessing(false);
      }
    };

    processFiles();

    // Cleanup: prevent state updates after unmount
    return () => {
      isCancelled = true;
    };
  }, [files]);

  const failedResults = results.filter((r) => r.status === "error");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {isProcessing ? m.bulkProgress_importingTitle() : m.bulkProgress_completeTitle()}
        </CardTitle>
        <CardDescription>
          {isProcessing
            ? m.bulkProgress_processingDesc({ processed, total: files.length })
            : m.bulkProgress_completeDesc({ imported, total: files.length })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isProcessing
            ? `Processing ${processed} of ${files.length} files`
            : `Import complete. ${imported} imported, ${duplicates} duplicates skipped, ${failed} failed.`}
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{m.bulkProgress_progressLabel()}</span>
              <span className="font-medium">{m.bulkProgress_progressPercent({ percent: percentage })}</span>
            </div>
            <Progress value={percentage} />
          </div>
        )}

        {/* Status summary - Story 8.4: Show duplicates count (AC #6) */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xl font-bold">{imported}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.bulkProgress_importedLabel()}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xl font-bold">{duplicates}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.bulkProgress_duplicatesLabel()}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-xl font-bold">{failed}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.bulkProgress_failedLabel()}</p>
          </div>
        </div>

        {/* File list - show during processing or if there are failures */}
        {(isProcessing || failedResults.length > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-muted-foreground">
                {isProcessing ? "Processing files" : "Files"}
              </p>
              {!isProcessing && failedResults.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFailures(!showFailures)}
                  className="text-xs"
                >
                  {showFailures ? m.bulkProgress_hideFailures() : m.bulkProgress_showFailures()}
                  <ChevronDown
                    className={cn(
                      "ml-1 h-3 w-3 transition-transform",
                      showFailures && "rotate-180",
                    )}
                  />
                </Button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {(isProcessing ? results : showFailures ? failedResults : []).map((result) => (
                <FileStatusRow key={result.filename} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Failure details */}
        {!isProcessing && failedResults.length > 0 && showFailures && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{m.bulkProgress_errorDetails()}</p>
            {failedResults.map((result) => (
              <div
                key={result.filename}
                className="p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm"
              >
                <p className="font-medium text-red-800 dark:text-red-200">{result.filename}</p>
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{result.error}</p>
              </div>
            ))}
          </div>
        )}

        {/* Success message */}
        {!isProcessing && imported > 0 && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">{m.bulkProgress_successTitle()}</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {m.bulkProgress_successDesc({ count: imported })}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        {isProcessing ? (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {m.common_cancel()}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onComplete} className="flex-1">
              {m.bulkProgress_importMore()}
            </Button>
            {imported > 0 && (
              <Button render={<Link to="/newsletters" />} className="flex-1">
                  {m.bulkProgress_viewNewsletters()}
                  <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

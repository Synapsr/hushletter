/**
 * Manual Import Route
 * Story 8.2: Drag-and-Drop Import UI
 *
 * Allows users to manually import newsletters by dragging .eml files.
 * Supports both single file preview and bulk import flows.
 *
 * State Flow:
 * IDLE → PARSING → (single) PREVIEW → UPLOADING → SUCCESS
 *                → (multiple) BULK_PROGRESS → COMPLETE
 */

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { parseEmlFile, type ParsedEml, type EmlParseResult } from "@hushletter/shared";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hushletter/ui";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { EmlDropZone } from "@/components/import/EmlDropZone";
import { EmlPreview } from "@/components/import/EmlPreview";
import { BulkImportProgress } from "@/components/import/BulkImportProgress";
import { readFileAsArrayBuffer, getParserErrorMessage } from "@/components/import/emlUtils";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_authed/_navigation/import/manual")({
  component: ManualImportPage,
});

/** Import state machine */
type ImportState =
  | { type: "idle" }
  | { type: "parsing"; fileCount: number }
  | { type: "preview"; parsed: ParsedEml }
  | { type: "uploading"; parsed: ParsedEml }
  | { type: "bulk_progress"; files: File[] }
  | { type: "error"; message: string };

/**
 * Error Alert Component (inline pattern from SenderReview)
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
        aria-label={m.importManual_dismissError()}
      >
        {m.importManual_dismissError()}
      </button>
    </div>
  );
}

/**
 * Manual Import Page Component
 */
function ManualImportPage() {
  const [state, setState] = useState<ImportState>({ type: "idle" });
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const importAction = useAction(api.manualImport.importEmlNewsletter);

  // Handle files selected from drop zone
  const handleFilesSelected = async (files: File[]) => {
    setError(null);

    if (files.length === 0) return;

    // Multiple files → go to bulk import
    if (files.length > 1) {
      setState({ type: "bulk_progress", files });
      return;
    }

    // Single file → parse and preview
    const file = files[0];
    setState({ type: "parsing", fileCount: 1 });

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const result: EmlParseResult = await parseEmlFile(buffer);

      if (!result.success) {
        // Parser error
        const errorMessage = getParserErrorMessage(result.error.code);
        setError(errorMessage);
        setState({ type: "idle" });
        return;
      }

      // Show preview
      setState({ type: "preview", parsed: result.data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to read file";
      setError(errorMessage);
      setState({ type: "idle" });
    }
  };

  // Handle single file import confirmation
  const handleConfirmImport = async () => {
    if (state.type !== "preview") return;

    setState({ type: "uploading", parsed: state.parsed });
    setError(null);

    try {
      const result = await importAction({
        subject: state.parsed.subject,
        senderEmail: state.parsed.senderEmail,
        senderName: state.parsed.senderName ?? undefined,
        receivedAt: state.parsed.receivedAt,
        htmlContent: state.parsed.htmlContent ?? undefined,
        textContent: state.parsed.textContent ?? undefined,
        messageId: state.parsed.messageId ?? undefined,
      });

      // Story 8.4: Handle duplicate detection - navigate to existing newsletter
      if (result.skipped) {
        // Navigate to the existing newsletter (FR33 - no error shown)
        navigate({
          to: "/newsletters/$id",
          params: { id: result.existingId },
        });
        return;
      }

      // Navigate to the imported newsletter
      navigate({
        to: "/newsletters/$id",
        params: { id: result.userNewsletterId },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import newsletter";
      setError(errorMessage);
      setState({ type: "idle" });
    }
  };

  // Handle cancel/back actions
  const handleCancel = () => {
    setState({ type: "idle" });
    setError(null);
  };

  // Handle bulk import completion
  const handleBulkComplete = () => {
    setState({ type: "idle" });
    setError(null);
  };

  // Handle drop zone errors
  const handleDropZoneError = (message: string) => {
    setError(message);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/import"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {m.importManual_backToImport()}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{m.importManual_title()}</h1>
        <p className="text-muted-foreground">
          {m.importManual_description()}
        </p>
      </div>

      {/* Error display */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* IDLE STATE: Show drop zone */}
      {state.type === "idle" && (
        <EmlDropZone
          onFilesSelected={handleFilesSelected}
          onError={handleDropZoneError}
          disabled={false}
        />
      )}

      {/* PARSING STATE: Show loading */}
      {state.type === "parsing" && (
        <Card>
          <CardHeader>
            <CardTitle>{m.importManual_parsing()}</CardTitle>
            <CardDescription>{m.importManual_parsingDesc()}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}

      {/* PREVIEW STATE: Show preview with confirm/cancel */}
      {state.type === "preview" && (
        <EmlPreview
          parsedEml={state.parsed}
          onConfirm={handleConfirmImport}
          onCancel={handleCancel}
          isImporting={false}
        />
      )}

      {/* UPLOADING STATE: Show preview in loading state */}
      {state.type === "uploading" && (
        <EmlPreview
          parsedEml={state.parsed}
          onConfirm={handleConfirmImport}
          onCancel={handleCancel}
          isImporting={true}
        />
      )}

      {/* BULK PROGRESS STATE: Show bulk import progress */}
      {state.type === "bulk_progress" && (
        <BulkImportProgress
          files={state.files}
          onComplete={handleBulkComplete}
          onCancel={handleCancel}
        />
      )}

      {/* Help text */}
      {state.type === "idle" && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
            {m.importManual_howToExport()}
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>
              <strong>{m.importManual_gmail()}</strong> {m.importManual_gmailSteps()}
            </li>
            <li>
              <strong>{m.importManual_outlook()}</strong> {m.importManual_outlookSteps()}
            </li>
            <li>
              <strong>{m.importManual_appleMail()}</strong> {m.importManual_appleMailSteps()}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

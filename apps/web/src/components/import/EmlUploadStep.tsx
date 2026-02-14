import { useState } from "react";
import { parseEmlFile, type ParsedEml, type EmlParseResult } from "@hushletter/shared";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Loader2, AlertCircle } from "lucide-react";
import { EmlDropZone } from "./EmlDropZone";
import { EmlPreview } from "./EmlPreview";
import { BulkImportProgress } from "./BulkImportProgress";
import { readFileAsArrayBuffer, getParserErrorMessage } from "./emlUtils";
import { m } from "@/paraglide/messages.js";

interface EmlUploadStepProps {
  onClose: () => void;
}

type UploadState =
  | { type: "idle" }
  | { type: "parsing" }
  | { type: "preview"; parsed: ParsedEml }
  | { type: "uploading"; parsed: ParsedEml }
  | { type: "bulk_progress"; files: File[] }
  | { type: "error"; message: string };

export function EmlUploadStep({ onClose }: EmlUploadStepProps) {
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const [error, setError] = useState<string | null>(null);

  const importAction = useAction(api.manualImport.importEmlNewsletter);

  const handleFilesSelected = async (files: File[]) => {
    setError(null);

    if (files.length === 0) return;

    if (files.length > 1) {
      setState({ type: "bulk_progress", files });
      return;
    }

    const file = files[0];
    setState({ type: "parsing" });

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const result: EmlParseResult = await parseEmlFile(buffer);

      if (!result.success) {
        setError(getParserErrorMessage(result.error.code));
        setState({ type: "idle" });
        return;
      }

      setState({ type: "preview", parsed: result.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setState({ type: "idle" });
    }
  };

  const handleConfirmImport = async () => {
    if (state.type !== "preview") return;

    setState({ type: "uploading", parsed: state.parsed });
    setError(null);

    try {
      await importAction({
        subject: state.parsed.subject,
        senderEmail: state.parsed.senderEmail,
        senderName: state.parsed.senderName ?? undefined,
        receivedAt: state.parsed.receivedAt,
        htmlContent: state.parsed.htmlContent ?? undefined,
        textContent: state.parsed.textContent ?? undefined,
        messageId: state.parsed.messageId ?? undefined,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import newsletter");
      setState({ type: "idle" });
    }
  };

  const handleCancel = () => {
    setState({ type: "idle" });
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900"
        >
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm font-medium"
            aria-label={m.importManual_dismissError()}
          >
            {m.importManual_dismissError()}
          </button>
        </div>
      )}

      {state.type === "idle" && (
        <EmlDropZone
          onFilesSelected={handleFilesSelected}
          onError={(msg) => setError(msg)}
          disabled={false}
        />
      )}

      {state.type === "parsing" && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {(state.type === "preview" || state.type === "uploading") && (
        <EmlPreview
          parsedEml={state.parsed}
          onConfirm={handleConfirmImport}
          onCancel={handleCancel}
          isImporting={state.type === "uploading"}
        />
      )}

      {state.type === "bulk_progress" && (
        <BulkImportProgress
          files={state.files}
          onComplete={onClose}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

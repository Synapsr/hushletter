import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { Button } from "@hushletter/ui";
import { Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";

/**
 * Props for BulkImportBar component
 * Story 9.9 Task 5.3-5.5
 */
interface BulkImportBarProps {
  selectedIds: Set<Id<"newsletterContent">>;
  onClearSelection: () => void;
  onImportComplete: () => void;
}

/**
 * BulkImportBar - Floating action bar for bulk importing community newsletters
 * Story 9.9 Task 5.3-5.5
 *
 * Features:
 * - Shows selected count
 * - Import button that calls bulkImportFromCommunity
 * - Loading spinner during import (single mutation, no granular progress)
 * - Completion summary toast
 * - Clear selection action
 */
export function BulkImportBar({
  selectedIds,
  onClearSelection,
  onImportComplete,
}: BulkImportBarProps) {
  const [isImporting, setIsImporting] = useState(false);

  const bulkImport = useMutation(api.community.bulkImportFromCommunity);

  const handleBulkImport = async () => {
    setIsImporting(true);

    try {
      const result = await bulkImport({
        contentIds: Array.from(selectedIds),
      });

      // Story 9.9 Task 5.5: Show completion summary
      if (result.imported > 0 && result.skipped === 0 && result.failed === 0) {
        toast.success(m.bulkImport_successImported({ count: result.imported }));
      } else {
        const parts = [];
        if (result.imported > 0) {
          parts.push(m.bulkImport_imported({ count: result.imported }));
        }
        if (result.skipped > 0) {
          parts.push(m.bulkImport_alreadyInCollection({ count: result.skipped }));
        }
        if (result.failed > 0) {
          parts.push(m.bulkImport_failed({ count: result.failed }));
        }
        toast.info(m.bulkImport_completeDetails({ details: parts.join(", ") }), { duration: 5000 });
      }

      onImportComplete();
      onClearSelection();
    } catch {
      toast.error(m.bulkImport_errorFailed());
    } finally {
      setIsImporting(false);
    }
  };

  // Don't render if nothing selected
  if (selectedIds.size === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
        {isImporting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              {m.bulkImport_importing({ count: selectedIds.size })}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">{m.bulkImport_selected({ count: selectedIds.size })}</span>
            <Button onClick={handleBulkImport} size="sm">
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              {m.bulkImport_buttonImportSelected()}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              aria-label={m.bulkImport_ariaClearSelection()}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

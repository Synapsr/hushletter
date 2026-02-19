import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import {
  Button,
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@hushletter/ui";
import { AlertCircle } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/**
 * MergeFolderDialog - Dialog for merging one folder into another
 * Story 9.5: Task 4.4, 4.6 - Merge dialog with confirmation (AC #1, #2, #3, #4)
 *
 * Allows user to select a target folder to merge into.
 * Shows undo toast on success with countdown.
 */

/** Type for folder data from listVisibleFoldersWithUnreadCounts query */
interface FolderData {
  _id: string;
  name: string;
  newsletterCount: number;
}

/** Type guard for folder data */
function isFolderData(item: unknown): item is FolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number"
  );
}

interface MergeFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFolderId: string;
  sourceFolderName: string;
}

export function MergeFolderDialog({
  open,
  onOpenChange,
  sourceFolderId,
  sourceFolderName,
}: MergeFolderDialogProps) {
  type FolderItem = { value: string; label: string };
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const queryClient = useQueryClient();

  const { data: foldersRaw, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}),
  );

  // Validate and filter folder data
  const folders =
    (foldersRaw as unknown[] | undefined)?.filter(isFolderData) ?? [];

  // Type for merge mutation result
  type MergeResult = {
    mergeId: string;
    movedNewsletterCount: number;
    movedSenderCount: number;
  };

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  // Code Review Fix HIGH-3: Better error messages for specific failure cases
  const mergeMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.mergeFolders),
    onSuccess: (data) => {
      const result = data as MergeResult;
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      onOpenChange(false);
      setSelectedFolder(null);

      // Show toast with undo action - Task 3.7
      toast.success(
        m.mergeFolderDlg_mergeSuccess({ count: result.movedNewsletterCount }),
        {
          action: {
            label: m.mergeFolderDlg_undo(),
            onClick: () => undoMutation.mutate({ mergeId: result.mergeId }),
          },
          duration: 10000, // 10 seconds visible (undo window is 30s on backend)
        },
      );
    },
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Cannot merge folder into itself")) {
          toast.error(m.mergeFolderDlg_errorSelfMerge());
        } else if (error.message.includes("Target folder not found")) {
          toast.error(m.mergeFolderDlg_errorTargetNotFound());
        } else if (error.message.includes("Source folder not found")) {
          toast.error(m.mergeFolderDlg_errorSourceNotFound());
        } else {
          toast.error(m.mergeFolderDlg_errorGeneric());
        }
      } else {
        toast.error(m.mergeFolderDlg_errorGeneric());
      }
    },
  });

  // Code Review Fix HIGH-2: Handle partial restoration with user feedback
  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  const undoMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.undoFolderMerge),
    onSuccess: (data) => {
      const result = data as {
        restoredFolderId: string;
        restoredSenderCount: number;
        restoredNewsletterCount: number;
        skippedSenderCount: number;
        skippedNewsletterCount: number;
      };
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });

      const skippedTotal =
        result.skippedSenderCount + result.skippedNewsletterCount;
      if (skippedTotal > 0) {
        toast.warning(
          m.mergeFolderDlg_undoPartialSuccess({ count: skippedTotal }),
        );
      } else {
        toast.success(m.mergeFolderDlg_undoSuccess());
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("expired")) {
        toast.error(m.mergeFolderDlg_undoExpired());
      } else {
        toast.error(m.mergeFolderDlg_undoError());
      }
    },
  });

  // Reset target when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFolder(null);
    }
  }, [open]);

  // Filter out source folder from targets
  const availableTargets = folders.filter((f) => f._id !== sourceFolderId);

  const folderItems: FolderItem[] = availableTargets.map((f) => ({
    value: f._id,
    label: m.mergeFolderDlg_targetOption({
      folderName: f.name,
      count: f.newsletterCount,
    }),
  }));

  const handleMerge = () => {
    if (selectedFolder) {
      mergeMutation.mutate({
        sourceFolderId: sourceFolderId as Parameters<
          typeof mergeMutation.mutate
        >[0]["sourceFolderId"],
        targetFolderId: selectedFolder.value as Parameters<
          typeof mergeMutation.mutate
        >[0]["targetFolderId"],
      });
    }
  };

  const selectedTarget = availableTargets.find(
    (f) => f._id === selectedFolder?.value,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{m.mergeFolderDlg_title()}</DialogTitle>
          <DialogDescription>
            {m.mergeFolderDlg_description({ sourceFolderName })}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="py-4 space-y-4">
          <div>
            <label
              htmlFor="target-folder"
              className="text-sm font-medium block mb-2"
            >
              {m.mergeFolderDlg_mergeIntoLabel()}
            </label>
            {foldersPending ? (
              <div className="h-10 bg-muted rounded-md animate-pulse" />
            ) : availableTargets.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 border rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{m.mergeFolderDlg_noTargetsAvailable()}</span>
              </div>
            ) : (
              <Combobox
                items={folderItems}
                value={selectedFolder}
                onValueChange={(value) => setSelectedFolder(value)}
              >
                <ComboboxInput
                  placeholder={m.mergeFolderDlg_selectPlaceholder()}
                />
                <ComboboxPopup>
                  <ComboboxEmpty>
                    {m.mergeFolderDlg_noTargetsAvailable()}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem
                        key={item.value}
                        value={item}
                        className="flex ps-2"
                      >
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
            )}
          </div>

          {selectedTarget && (
            <p className="text-sm text-muted-foreground">
              {m.mergeFolderDlg_confirmationText({
                sourceFolderName,
                targetFolderName: selectedTarget.name,
              })}
            </p>
          )}
        </DialogPanel>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {m.mergeFolderDlg_cancel()}
          </Button>
          <Button
            onClick={handleMerge}
            disabled={
              !selectedFolder ||
              mergeMutation.isPending ||
              availableTargets.length === 0
            }
          >
            {mergeMutation.isPending
              ? m.mergeFolderDlg_merging()
              : m.mergeFolderDlg_merge()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

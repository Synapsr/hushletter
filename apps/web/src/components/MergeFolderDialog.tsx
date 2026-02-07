import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation, convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

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
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: foldersRaw, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}),
  );

  // Validate and filter folder data
  const folders = (foldersRaw as unknown[] | undefined)?.filter(isFolderData) ?? [];

  // Type for merge mutation result
  type MergeResult = { mergeId: string; movedNewsletterCount: number; movedSenderCount: number };

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  // Code Review Fix HIGH-3: Better error messages for specific failure cases
  const mergeMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.mergeFolders),
    onSuccess: (data) => {
      const result = data as MergeResult;
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      onOpenChange(false);
      setTargetFolderId("");

      // Show toast with undo action - Task 3.7
      toast.success(`Merged ${result.movedNewsletterCount} newsletters into folder`, {
        action: {
          label: "Undo",
          onClick: () => undoMutation.mutate({ mergeId: result.mergeId }),
        },
        duration: 10000, // 10 seconds visible (undo window is 30s on backend)
      });
    },
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Cannot merge folder into itself")) {
          toast.error("Cannot merge a folder into itself");
        } else if (error.message.includes("Target folder not found")) {
          toast.error("Target folder no longer exists - it may have been deleted");
        } else if (error.message.includes("Source folder not found")) {
          toast.error("Source folder no longer exists - it may have been deleted");
        } else {
          toast.error("Failed to merge folders");
        }
      } else {
        toast.error("Failed to merge folders");
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

      const skippedTotal = result.skippedSenderCount + result.skippedNewsletterCount;
      if (skippedTotal > 0) {
        toast.warning(
          `Folder restored, but ${skippedTotal} item${skippedTotal > 1 ? "s were" : " was"} deleted and couldn't be recovered`,
        );
      } else {
        toast.success("Merge undone - folder restored");
      }
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("expired")) {
        toast.error("Undo window has expired");
      } else {
        toast.error("Failed to undo merge");
      }
    },
  });

  // Reset target when dialog opens
  useEffect(() => {
    if (open) {
      setTargetFolderId("");
    }
  }, [open]);

  // Filter out source folder from targets
  const availableTargets = folders.filter((f) => f._id !== sourceFolderId);

  const handleMerge = () => {
    if (targetFolderId) {
      mergeMutation.mutate({
        sourceFolderId: sourceFolderId as Parameters<
          typeof mergeMutation.mutate
        >[0]["sourceFolderId"],
        targetFolderId: targetFolderId as Parameters<
          typeof mergeMutation.mutate
        >[0]["targetFolderId"],
      });
    }
  };

  const selectedTarget = availableTargets.find((f) => f._id === targetFolderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Merge Folder</DialogTitle>
          <DialogDescription>
            Move all newsletters and senders from "{sourceFolderName}" into another folder. The "
            {sourceFolderName}" folder will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <label htmlFor="target-folder" className="text-sm font-medium block mb-2">
              Merge into:
            </label>
            {foldersPending ? (
              <div className="h-10 bg-muted rounded-md animate-pulse" />
            ) : availableTargets.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 border rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>No other folders available to merge into</span>
              </div>
            ) : (
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger id="target-folder">
                  <SelectValue placeholder="Select target folder" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((folder) => (
                    <SelectItem key={folder._id} value={folder._id}>
                      {folder.name} ({folder.newsletterCount} newsletters)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTarget && (
            <p className="text-sm text-muted-foreground">
              All newsletters and senders from "{sourceFolderName}" will be moved to "
              {selectedTarget.name}". This action can be undone within 30 seconds.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!targetFolderId || mergeMutation.isPending || availableTargets.length === 0}
          >
            {mergeMutation.isPending ? "Merging..." : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

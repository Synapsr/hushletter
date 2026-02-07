import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderIcon, Eye, AlertCircle, ExternalLink } from "lucide-react";

/**
 * HiddenFoldersSection - Settings component for managing hidden folders
 * Story 9.5: Task 4.5, 5.1-5.4 - Hidden folders in settings (AC #7, #8)
 *
 * Features:
 * - Lists hidden folders with newsletter/sender counts
 * - Unhide button to restore folder to sidebar
 * - Code Review Fix MEDIUM-4: Navigation to view folder contents
 */

/** Type for hidden folder data */
interface HiddenFolderData {
  _id: string;
  name: string;
  color?: string;
  newsletterCount: number;
  senderCount: number;
}

/** Type guard for hidden folder data */
function isHiddenFolderData(item: unknown): item is HiddenFolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number" &&
    typeof obj.senderCount === "number"
  );
}

export function HiddenFoldersSection() {
  const queryClient = useQueryClient();

  const {
    data: hiddenFoldersRaw,
    isPending,
    isError,
  } = useQuery(convexQuery(api.folders.listHiddenFolders, {}));

  const hiddenFolders =
    (hiddenFoldersRaw as unknown[] | undefined)?.filter(isHiddenFolderData) ?? [];

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  const unhideMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.unhideFolder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast.success("Folder restored to sidebar");
    },
    onError: () => {
      toast.error("Failed to unhide folder");
    },
  });

  if (isPending) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading hidden folders">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>Failed to load hidden folders</span>
      </div>
    );
  }

  if (hiddenFolders.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hidden folders. Hidden folders will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Hidden folders">
      {hiddenFolders.map((folder) => (
        <li key={folder._id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <FolderIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">{folder.name}</p>
              <p className="text-sm text-muted-foreground">
                {folder.newsletterCount} newsletter
                {folder.newsletterCount !== 1 ? "s" : ""}, {folder.senderCount} sender
                {folder.senderCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Code Review Fix MEDIUM-4: Add navigation to folder contents (Task 5.4) */}
            <Link
              to="/newsletters"
              search={{ folder: folder._id }}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              aria-label={`View contents of ${folder.name}`}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                unhideMutation.mutate({
                  folderId: folder._id as Parameters<typeof unhideMutation.mutate>[0]["folderId"],
                })
              }
              disabled={unhideMutation.isPending}
              aria-label={`Unhide ${folder.name}`}
            >
              <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
              Unhide
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

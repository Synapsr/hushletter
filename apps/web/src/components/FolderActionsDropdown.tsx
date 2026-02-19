import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import {
  ArchiveBoldIcon,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EditOneIcon,
} from "@hushletter/ui";
import { MoreHorizontal, Pencil, EyeOff, Merge } from "lucide-react";
import { RenameFolderDialog } from "./RenameFolderDialog";
import { MergeFolderDialog } from "./MergeFolderDialog";
import { m } from "@/paraglide/messages.js";

/**
 * FolderActionsDropdown - Dropdown menu for folder actions
 * Story 9.5: Task 4.1, 4.2 - Folder actions UI
 *
 * Actions:
 * - Rename: Opens rename dialog
 * - Hide: Hides folder from sidebar (immediate action)
 * - Merge into...: Opens merge dialog
 */

interface FolderActionsDropdownProps {
  folderId: string;
  folderName: string;
  onHideSuccess?: () => void;
}

export function FolderActionsDropdown({
  folderId,
  folderName,
  onHideSuccess,
}: FolderActionsDropdownProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const queryClient = useQueryClient();

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  const hideMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.hideFolder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast.success(m.folderActions_hiddenSuccess({ folderName }));
      onHideSuccess?.();
    },
    onError: () => {
      toast.error(m.folderActions_hiddenError());
    },
  });

  const handleHide = () => {
    hideMutation.mutate({
      folderId: folderId as Parameters<
        typeof hideMutation.mutate
      >[0]["folderId"],
    });
  };

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 transition-opacity ${
                isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label={m.folderActions_ariaLabel({ folderName })}
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
            <EditOneIcon className="size-4" />
            {m.folderActions_rename()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleHide}
            disabled={hideMutation.isPending}
          >
            <ArchiveBoldIcon className="size-4" />
            {m.folderActions_hide()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsMergeOpen(true)}>
            <Merge className="size-3.5" />
            {m.folderActions_mergeInto()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameFolderDialog
        open={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        folderId={folderId}
        currentName={folderName}
      />

      <MergeFolderDialog
        open={isMergeOpen}
        onOpenChange={setIsMergeOpen}
        sourceFolderId={folderId}
        sourceFolderName={folderName}
      />
    </>
  );
}

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import { MoreHorizontal, Pencil, EyeOff, Merge } from "lucide-react"
import { RenameFolderDialog } from "./RenameFolderDialog"
import { MergeFolderDialog } from "./MergeFolderDialog"

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
  folderId: string
  folderName: string
  onHideSuccess?: () => void
}

export function FolderActionsDropdown({
  folderId,
  folderName,
  onHideSuccess,
}: FolderActionsDropdownProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isMergeOpen, setIsMergeOpen] = useState(false)
  const queryClient = useQueryClient()

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  const hideMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.hideFolder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] })
      queryClient.invalidateQueries({ queryKey: ["newsletters"] })
      toast.success(`"${folderName}" hidden from sidebar`)
      onHideSuccess?.()
    },
    onError: () => {
      toast.error("Failed to hide folder")
    },
  })

  const handleHide = () => {
    hideMutation.mutate({ folderId: folderId as Parameters<typeof hideMutation.mutate>[0]["folderId"] })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Actions for ${folderName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleHide} disabled={hideMutation.isPending}>
            <EyeOff className="mr-2 h-4 w-4" />
            Hide
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsMergeOpen(true)}>
            <Merge className="mr-2 h-4 w-4" />
            Merge into...
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
  )
}

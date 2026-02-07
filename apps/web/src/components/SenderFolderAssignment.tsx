import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useMutation } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { useForm } from "@tanstack/react-form"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "~/components/ui/dialog"
import { FolderIcon, CheckIcon } from "lucide-react"

/**
 * Folder data type (minimal for folder selection)
 */
interface FolderData {
  _id: Id<"folders">
  name: string
}

interface SenderFolderAssignmentProps {
  senderId: Id<"senders">
  senderName: string
  currentFolderId?: Id<"folders">
  trigger?: React.ReactNode
}

/**
 * SenderFolderAssignment - Dialog to assign a sender to a folder
 * Story 3.3 Task 4.1, 4.2, 4.3 (AC2)
 *
 * Uses updateSenderSettings mutation with folderId parameter.
 * Uses TanStack Form for isSubmitting state per project-context.md.
 */
export function SenderFolderAssignment({
  senderId,
  senderName,
  currentFolderId,
  trigger,
}: SenderFolderAssignmentProps) {
  const [open, setOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined>(
    currentFolderId
  )

  const { data: folders } = useQuery(
    convexQuery(api.folders.listFolders, {})
  )

  const updateSenderSettings = useMutation(api.senders.updateSenderSettings)

  const folderList = (folders ?? []) as FolderData[]

  // Using TanStack Form for isSubmitting state (project-context.md pattern)
  const form = useForm({
    defaultValues: {},
    onSubmit: async () => {
      // Task 4.3: Use updateSenderSettings mutation with folderId parameter
      await updateSenderSettings({
        senderId,
        folderId: selectedFolderId,
      })
      setOpen(false)
    },
  })

  const currentFolder = folderList.find((f) => f._id === currentFolderId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <FolderIcon className="h-4 w-4 mr-2" />
            {currentFolder ? currentFolder.name : "Assign to Folder"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign "{senderName}" to Folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="space-y-4 py-4">
            <Select
              value={selectedFolderId ?? "none"}
              onValueChange={(value) =>
                setSelectedFolderId(value === "none" ? undefined : (value as Id<"folders">))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No folder (Uncategorized)</span>
                </SelectItem>
                {folderList.map((folder) => (
                  <SelectItem key={folder._id} value={folder._id}>
                    <div className="flex items-center gap-2">
                      <FolderIcon className="h-4 w-4" />
                      {folder.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {folderList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No folders yet. Create a folder first from the sidebar.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * SenderFolderDropdown - Inline dropdown for folder assignment
 * Story 3.3 Task 4.1 - Alternative compact UI for folder assignment
 *
 * Uses TanStack Form for isSubmitting state per project-context.md.
 */
export function SenderFolderDropdown({
  senderId,
  currentFolderId,
}: {
  senderId: Id<"senders">
  currentFolderId?: Id<"folders">
}) {
  const { data: folders } = useQuery(
    convexQuery(api.folders.listFolders, {})
  )

  const updateSenderSettings = useMutation(api.senders.updateSenderSettings)

  const folderList = (folders ?? []) as FolderData[]

  // Using TanStack Form for isSubmitting state
  const form = useForm({
    defaultValues: { folderId: currentFolderId },
    onSubmit: async ({ value }) => {
      await updateSenderSettings({
        senderId,
        folderId: value.folderId,
      })
    },
  })

  const handleChange = (value: string) => {
    const newFolderId = value === "none" ? undefined : (value as Id<"folders">)
    form.setFieldValue("folderId", newFolderId)
    form.handleSubmit()
  }

  const currentFolder = folderList.find((f) => f._id === currentFolderId)

  return (
    <form.Subscribe
      selector={(state) => state.isSubmitting}
      children={(isSubmitting) => (
        <Select
          value={currentFolderId ?? "none"}
          onValueChange={handleChange}
          disabled={isSubmitting}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <SelectValue>
                {currentFolder?.name ?? "No folder"}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">No folder</span>
            </SelectItem>
            {folderList.map((folder) => (
              <SelectItem key={folder._id} value={folder._id}>
                <div className="flex items-center gap-2">
                  {folder._id === currentFolderId && (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {folder.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}

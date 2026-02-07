import { useQuery } from "@tanstack/react-query"
import { useMutation } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "~/components/ui/dialog"
import { FolderIcon, PencilIcon, TrashIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

/**
 * Folder data type from listFoldersWithUnreadCounts query
 */
interface FolderData {
  _id: Id<"folders">
  userId: Id<"users">
  name: string
  color?: string
  createdAt: number
  newsletterCount: number
  unreadCount: number
  senderCount: number
}

/**
 * Zod schema for folder name validation
 * Story 3.3 Task 3.3
 */
const folderNameSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(50, "Folder name too long"),
})

/**
 * CreateFolderDialog - Dialog for creating a new folder
 * Story 3.3 Task 3.1 (AC1)
 */
function CreateFolderDialog() {
  const [open, setOpen] = useState(false)
  const createFolder = useMutation(api.folders.createFolder)

  const form = useForm({
    defaultValues: { name: "" },
    validators: { onChange: folderNameSchema },
    onSubmit: async ({ value }) => {
      try {
        await createFolder({ name: value.name })
        setOpen(false)
        form.reset()
      } catch (error) {
        // Story 3.3 Task 3.4: Handle duplicate folder name error
        if (error instanceof Error && error.message.includes("DUPLICATE")) {
          form.setFieldMeta("name", (prev) => ({
            ...prev,
            errors: ["A folder with this name already exists"],
          }))
        } else {
          throw error
        }
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="name"
            children={(field) => (
              <div className="space-y-2">
                <Input
                  placeholder="Folder name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                />
                {field.state.meta.errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {String(error)}
                  </p>
                ))}
              </div>
            )}
          />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create"}
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
 * EditFolderDialog - Dialog for editing a folder
 * Story 3.3 Task 3.1
 */
function EditFolderDialog({ folder }: { folder: FolderData }) {
  const [open, setOpen] = useState(false)
  const updateFolder = useMutation(api.folders.updateFolder)

  const form = useForm({
    defaultValues: { name: folder.name },
    validators: { onChange: folderNameSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateFolder({ folderId: folder._id, name: value.name })
        setOpen(false)
      } catch (error) {
        if (error instanceof Error && error.message.includes("DUPLICATE")) {
          form.setFieldMeta("name", (prev) => ({
            ...prev,
            errors: ["A folder with this name already exists"],
          }))
        } else {
          throw error
        }
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <PencilIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="name"
            children={(field) => (
              <div className="space-y-2">
                <Input
                  placeholder="Folder name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                />
                {field.state.meta.errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {String(error)}
                  </p>
                ))}
              </div>
            )}
          />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
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
 * DeleteFolderDialog - Confirmation dialog for deleting a folder
 * Story 3.3 Task 3.1
 *
 * Uses TanStack Form for consistent loading state management (isSubmitting)
 * per project-context.md requirements.
 */
function DeleteFolderDialog({ folder }: { folder: FolderData }) {
  const [open, setOpen] = useState(false)
  const deleteFolder = useMutation(api.folders.deleteFolder)

  // Using TanStack Form for isSubmitting state (project-context.md pattern)
  const form = useForm({
    defaultValues: {},
    onSubmit: async () => {
      await deleteFolder({ folderId: folder._id as Id<"folders"> })
      setOpen(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
          <TrashIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          Are you sure you want to delete "{folder.name}"? Senders in this folder will become uncategorized.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button type="submit" variant="destructive" disabled={isSubmitting}>
                  {isSubmitting ? "Deleting..." : "Delete"}
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
 * FolderManagement - Component for managing folders
 * Story 3.3 Task 3.1, 3.2 (AC1)
 *
 * Can be used inline in sidebar or as a standalone settings section.
 */
export function FolderManagement() {
  const { data: folders, isPending } = useQuery(
    convexQuery(api.folders.listFoldersWithUnreadCounts, {})
  )

  const folderList = (folders ?? []) as FolderData[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Manage Folders</h3>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : folderList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No folders yet</p>
      ) : (
        <div className="space-y-1">
          {folderList.map((folder) => (
            <div
              key={folder._id}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-accent"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="text-sm truncate">{folder.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({folder.senderCount} senders)
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <EditFolderDialog folder={folder} />
                <DeleteFolderDialog folder={folder} />
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateFolderDialog />
    </div>
  )
}

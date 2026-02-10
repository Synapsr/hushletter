import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hushletter/ui";
import { FolderIcon, CheckIcon } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/**
 * Folder data type (minimal for folder selection)
 */
interface FolderData {
  _id: Id<"folders">;
  name: string;
}

interface SenderFolderAssignmentProps {
  senderId: Id<"senders">;
  senderName: string;
  currentFolderId?: Id<"folders">;
  trigger?: React.ReactNode;
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
  const [open, setOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined>(
    currentFolderId,
  );

  const { data: folders } = useQuery(convexQuery(api.folders.listFolders, {}));

  const updateSenderSettings = useMutation(api.senders.updateSenderSettings);

  const folderList = (folders ?? []) as FolderData[];

  // Using TanStack Form for isSubmitting state (project-context.md pattern)
  const form = useForm({
    defaultValues: {},
    onSubmit: async () => {
      // Task 4.3: Use updateSenderSettings mutation with folderId parameter
      await updateSenderSettings({
        senderId,
        folderId: selectedFolderId,
      });
      setOpen(false);
    },
  });

  const currentFolder = folderList.find((f) => f._id === currentFolderId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement}>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <FolderIcon className="h-4 w-4 mr-2" />
            {currentFolder ? currentFolder.name : m.senderFolder_assignToFolder()}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.senderFolder_assignTitle({ senderName })}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className="space-y-4 py-4">
            <Select
              value={selectedFolderId ?? "none"}
              onValueChange={(value) =>
                value !== null && setSelectedFolderId(value === "none" ? undefined : (value as Id<"folders">))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={m.senderFolder_selectPlaceholder()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">{m.senderFolder_noFolder()}</span>
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
                {m.senderFolder_noFoldersYet()}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
                {m.senderFolder_cancel()}
            </DialogClose>
            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.senderFolder_saving() : m.senderFolder_save()}
                </Button>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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
  senderId: Id<"senders">;
  currentFolderId?: Id<"folders">;
}) {
  const { data: folders } = useQuery(convexQuery(api.folders.listFolders, {}));

  const updateSenderSettings = useMutation(api.senders.updateSenderSettings);

  const folderList = (folders ?? []) as FolderData[];

  // Using TanStack Form for isSubmitting state
  const form = useForm({
    defaultValues: { folderId: currentFolderId },
    onSubmit: async ({ value }) => {
      await updateSenderSettings({
        senderId,
        folderId: value.folderId,
      });
    },
  });

  const handleChange = (value: string) => {
    const newFolderId = value === "none" ? undefined : (value as Id<"folders">);
    form.setFieldValue("folderId", newFolderId);
    form.handleSubmit();
  };

  const currentFolder = folderList.find((f) => f._id === currentFolderId);

  return (
    <form.Subscribe
      selector={(state) => state.isSubmitting}
      children={(isSubmitting) => (
        <Select
          value={currentFolderId ?? "none"}
          onValueChange={(v) => v !== null && handleChange(v)}
          disabled={isSubmitting}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <SelectValue>{currentFolder?.name ?? m.senderFolder_noFolderShort()}</SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">{m.senderFolder_noFolderShort()}</span>
            </SelectItem>
            {folderList.map((folder) => (
              <SelectItem key={folder._id} value={folder._id}>
                <div className="flex items-center gap-2">
                  {folder._id === currentFolderId && <CheckIcon className="h-4 w-4" />}
                  {folder.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";

/**
 * RenameFolderDialog - Dialog for renaming a folder
 * Story 9.5: Task 4.3 - Rename dialog component (AC #9, #10)
 *
 * Uses TanStack Form with Zod validation per project-context.md.
 * Validates name is not empty and under 100 characters.
 */

// Zod schema for folder name validation
const folderNameSchema = z.object({
  name: z
    .string()
    .min(1, m.renameFolderDlg_nameRequired())
    .max(100, m.renameFolderDlg_nameTooLong()),
});

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  currentName: string;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folderId,
  currentName,
}: RenameFolderDialogProps) {
  const queryClient = useQueryClient();

  // Type for rename mutation result
  type RenameResult = { name: string };

  // Code Review Fix MEDIUM-1: Use specific query keys for invalidation
  const renameMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.renameFolder),
    onSuccess: (data) => {
      const result = data as RenameResult;
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(m.renameFolderDlg_success({ folderName: result.name }));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(m.renameFolderDlg_error());
    },
  });

  const form = useForm({
    defaultValues: { name: currentName },
    validators: {
      onChange: folderNameSchema,
    },
    onSubmit: async ({ value }) => {
      const trimmedName = value.name.trim();
      if (trimmedName && trimmedName !== currentName) {
        renameMutation.mutate({
          folderId: folderId as Parameters<typeof renameMutation.mutate>[0]["folderId"],
          newName: trimmedName,
        });
      } else if (trimmedName === currentName) {
        // No change, just close
        onOpenChange(false);
      }
    },
  });

  // Reset form when dialog opens with new name
  // Code Review Fix MEDIUM-2: Exclude form from deps (stable reference)
  // Using form.reset is safe as TanStack Form's reset is stable
  useEffect(() => {
    if (open) {
      form.reset({ name: currentName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{m.renameFolderDlg_title()}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            children={(field) => (
              <div>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={m.renameFolderDlg_placeholder()}
                  autoFocus
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={field.state.meta.errors.length > 0 ? "name-error" : undefined}
                />
                {field.state.meta.errors.map((err, i) => (
                  <p key={i} id="name-error" className="text-sm text-destructive mt-1">
                    {typeof err === "object" && err !== null && "message" in err
                      ? (err as { message: string }).message
                      : String(err)}
                  </p>
                ))}
              </div>
            )}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {m.renameFolderDlg_cancel()}
            </Button>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
              children={({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || renameMutation.isPending}
                >
                  {renameMutation.isPending ? m.renameFolderDlg_saving() : m.renameFolderDlg_save()}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

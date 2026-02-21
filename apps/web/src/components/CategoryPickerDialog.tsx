import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  Input,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import {
  FOLDER_CATEGORIES,
  getCategoryLabel,
  isPredefinedFolderCategory,
  type FolderCategory,
} from "@/lib/folder-categories";
import { m } from "@/paraglide/messages.js";

interface CategoryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  currentCategory?: string;
}

export function CategoryPickerDialog({
  open,
  onOpenChange,
  folderId,
  currentCategory,
}: CategoryPickerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPredefined, setSelectedPredefined] =
    useState<FolderCategory | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [isRemovingCategory, setIsRemovingCategory] = useState(false);

  const updateFolderMutation = useMutation({
    mutationFn: useConvexMutation(api.folders.updateFolder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(m.categoryPicker_success());
      onOpenChange(false);
    },
    onError: () => {
      toast.error(m.categoryPicker_error());
    },
  });

  useEffect(() => {
    if (!open) return;

    const normalizedCurrent = currentCategory?.trim() ?? "";
    setIsRemovingCategory(false);

    if (!normalizedCurrent) {
      setSelectedPredefined(null);
      setCustomCategory("");
      return;
    }

    const lowered = normalizedCurrent.toLowerCase();
    if (isPredefinedFolderCategory(lowered)) {
      setSelectedPredefined(lowered);
      setCustomCategory("");
      return;
    }

    setSelectedPredefined(null);
    setCustomCategory(normalizedCurrent);
  }, [open, currentCategory]);

  const nextCategory = useMemo(() => {
    if (isRemovingCategory) return null;

    const custom = customCategory.trim();
    if (custom.length > 0) return custom;
    if (selectedPredefined) return selectedPredefined;
    return undefined;
  }, [customCategory, isRemovingCategory, selectedPredefined]);

  const hasChanges = useMemo(() => {
    const current = currentCategory?.trim() || "";
    const next =
      typeof nextCategory === "string" ? nextCategory.trim() : nextCategory;

    if (!current && (next === undefined || next === null || next === "")) {
      return false;
    }

    if (!current && typeof next === "string") return true;
    if (current && (next === undefined || next === null || next === "")) {
      return true;
    }

    return current !== next;
  }, [currentCategory, nextCategory]);

  const handlePredefinedSelect = (category: FolderCategory) => {
    setSelectedPredefined(category);
    setCustomCategory("");
    setIsRemovingCategory(false);
  };

  const handleCustomCategoryChange = (value: string) => {
    setCustomCategory(value);
    setSelectedPredefined(null);
    setIsRemovingCategory(false);
  };

  const handleRemoveCategory = () => {
    setSelectedPredefined(null);
    setCustomCategory("");
    setIsRemovingCategory(true);
  };

  const handleSave = () => {
    if (!hasChanges) return;
    if (nextCategory === undefined) return;

    updateFolderMutation.mutate({
      folderId: folderId as Parameters<typeof updateFolderMutation.mutate>[0]["folderId"],
      category: nextCategory,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{m.categoryPicker_title()}</DialogTitle>
          <DialogDescription>{m.folderActions_category()}</DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FOLDER_CATEGORIES.map((category) => {
              const isActive =
                !isRemovingCategory &&
                customCategory.trim().length === 0 &&
                selectedPredefined === category;

              return (
                <Button
                  key={category}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className="justify-center h-9"
                  onClick={() => handlePredefinedSelect(category)}
                >
                  {getCategoryLabel(category)}
                </Button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="custom-folder-category"
              className="text-sm text-muted-foreground"
            >
              {m.categoryPicker_custom()}
            </label>
            <Input
              id="custom-folder-category"
              value={customCategory}
              onChange={(event) => handleCustomCategoryChange(event.target.value)}
              placeholder={m.categoryPicker_custom()}
            />
          </div>

          {currentCategory && (
            <button
              type="button"
              onClick={handleRemoveCategory}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs transition-colors",
                isRemovingCategory
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {m.categoryPicker_remove()}
            </button>
          )}

          {nextCategory && typeof nextCategory === "string" ? (
            <div className="text-sm text-muted-foreground">
              <Badge variant="outline" className="text-[10px] font-medium">
                {getCategoryLabel(nextCategory)}
              </Badge>
            </div>
          ) : null}
        </DialogPanel>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {m.renameFolderDlg_cancel()}
          </Button>
          <Button
            type="button"
            disabled={
              !hasChanges || nextCategory === undefined || updateFolderMutation.isPending
            }
            onClick={handleSave}
          >
            {updateFolderMutation.isPending
              ? m.renameFolderDlg_saving()
              : m.renameFolderDlg_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

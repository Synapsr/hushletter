import { importDialogHandle } from "@/components/import";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useAppHotkeys } from "./use-app-hotkeys";

export const useShortcuts = () => {
  const { bindings } = useAppHotkeys();

  useHotkey(bindings.openSettingsDialog, () => {
    document
      .querySelector<HTMLButtonElement>("[data-settings-trigger]")
      ?.click();
  });

  useHotkey(bindings.openImportDialog, () => {
    importDialogHandle.open(null);
  });
};

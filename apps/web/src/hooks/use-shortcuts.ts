import { importDialogHandle } from "@/components/import";
import { useHotkey } from "@tanstack/react-hotkeys";

export const useShortcuts = () => {
  useHotkey("Mod+,", () => {
    document
      .querySelector<HTMLButtonElement>("[data-settings-trigger]")
      ?.click();
  });

  useHotkey("Mod+I", () => {
    importDialogHandle.open(null);
  });
};

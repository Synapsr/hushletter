import { importDialogHandle } from "@/components/import";
import { useHotkey } from "@tanstack/react-hotkeys";

export const useShortcuts = () => {
  useHotkey("Mod+,", () => {
    console.log("Mod+, shortcut triggered");
    document
      .querySelector<HTMLButtonElement>("[data-settings-trigger]")
      ?.click();
  });

  useHotkey("Mod+I", () => {
    console.log("Mod+I shortcut triggered");
    importDialogHandle.open(null);
  });
};

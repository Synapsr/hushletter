import { Forward, Upload, Mail, ArrowRight } from "lucide-react";
import { m } from "@/paraglide/messages.js";

type ImportMethod = "forwarding" | "upload" | "gmail";

interface ImportMethodPickerProps {
  onSelect: (method: ImportMethod) => void;
}

const methods: { id: ImportMethod; icon: typeof Forward; titleKey: () => string; descKey: () => string }[] = [
  { id: "forwarding", icon: Forward, titleKey: () => m.importDialog_forwardTitle(), descKey: () => m.importDialog_forwardDescription() },
  { id: "upload", icon: Upload, titleKey: () => m.importDialog_uploadTitle(), descKey: () => m.importDialog_uploadDescription() },
  { id: "gmail", icon: Mail, titleKey: () => m.importDialog_gmailTitle(), descKey: () => m.importDialog_gmailDescription() },
];

export function ImportMethodPicker({ onSelect }: ImportMethodPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {methods.map(({ id, icon: Icon, titleKey, descKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{titleKey()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{descKey()}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

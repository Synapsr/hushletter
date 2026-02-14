import { useState } from "react";
import { Button, DialogClose } from "@hushletter/ui";
import { Copy, Check, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface ForwardingInstructionsProps {
  dedicatedEmail: string | null;
}

const providers = [
  {
    titleKey: () => m.importDialog_forwardingGmailTitle(),
    steps: () => [
      m.importDialog_forwardingGmailStep1(),
      m.importDialog_forwardingGmailStep2(),
      m.importDialog_forwardingGmailStep3(),
      m.importDialog_forwardingGmailStep4(),
    ],
  },
  {
    titleKey: () => m.importDialog_forwardingOutlookTitle(),
    steps: () => [
      m.importDialog_forwardingOutlookStep1(),
      m.importDialog_forwardingOutlookStep2(),
      m.importDialog_forwardingOutlookStep3(),
      m.importDialog_forwardingOutlookStep4(),
    ],
  },
  {
    titleKey: () => m.importDialog_forwardingAppleTitle(),
    steps: () => [
      m.importDialog_forwardingAppleStep1(),
      m.importDialog_forwardingAppleStep2(),
      m.importDialog_forwardingAppleStep3(),
      m.importDialog_forwardingAppleStep4(),
    ],
  },
];

export function ForwardingInstructions({ dedicatedEmail }: ForwardingInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);

  const handleCopy = async () => {
    if (!dedicatedEmail) return;
    try {
      await navigator.clipboard.writeText(dedicatedEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {m.importDialog_forwardingInstruction()}
      </p>

      {dedicatedEmail && (
        <button
          type="button"
          onClick={handleCopy}
          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold text-foreground truncate">
              {dedicatedEmail}
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-muted group-hover:bg-background transition-colors">
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>
      )}

      {/* Provider-specific guides */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
          {m.importDialog_forwardingSetupTitle()}
        </p>
        {providers.map(({ titleKey, steps }, i) => (
          <div key={i} className="rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setExpandedProvider(expandedProvider === i ? null : i)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg"
            >
              <span className="text-sm font-medium text-foreground">{titleKey()}</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  expandedProvider === i && "rotate-180",
                )}
              />
            </button>
            {expandedProvider === i && (
              <div className="px-3 pb-3 pt-0">
                <ol className="space-y-1.5 list-none">
                  {steps().map((step, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] font-medium mt-0.5">
                        {j + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manual forwarding tip */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          {m.importDialog_forwardingManualTip()}
        </p>
      </div>

      <DialogClose
        render={<Button className="w-full" />}
      >
        {m.importDialog_forwardingDone()}
      </DialogClose>
    </div>
  );
}

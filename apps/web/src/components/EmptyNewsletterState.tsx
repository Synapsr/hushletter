import { useState } from "react";
import { Button } from "@hushletter/ui";
import { Mail, Download, Copy, Check, ArrowRight } from "lucide-react";
import { ImportMethodDialog } from "@/components/import/ImportMethodDialog";
import { m } from "@/paraglide/messages.js";

interface EmptyNewsletterStateProps {
  dedicatedEmail: string | null;
}

const keyframes = `
@keyframes empty-fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/**
 * EmptyNewsletterState — shown when user has zero newsletters.
 * Two clear CTAs: copy your email address to subscribe, or import existing newsletters.
 */
export function EmptyNewsletterState({ dedicatedEmail }: EmptyNewsletterStateProps) {
  const [copied, setCopied] = useState(false);

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
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 max-w-md mx-auto">
      <style>{keyframes}</style>

      {/* Icon */}
      <div
        className="mb-6 flex items-center justify-center w-14 h-14 rounded-2xl bg-muted"
        style={{ animation: "empty-fade-in-up 500ms ease-out both" }}
      >
        <Mail className="w-7 h-7 text-muted-foreground" />
      </div>

      {/* Title */}
      <h2
        className="text-xl font-semibold text-foreground mb-2"
        style={{ animation: "empty-fade-in-up 500ms ease-out 60ms both" }}
      >
        {m.emptyState_noNewslettersYet()}
      </h2>

      {/* Subtitle */}
      <p
        className="text-sm text-muted-foreground leading-relaxed mb-8"
        style={{ animation: "empty-fade-in-up 500ms ease-out 120ms both" }}
      >
        {m.emptyState_subscribeHint()}
      </p>

      {/* Email copy block */}
      {dedicatedEmail && (
        <div
          className="w-full mb-4"
          style={{ animation: "empty-fade-in-up 500ms ease-out 180ms both" }}
        >
          <button
            type="button"
            onClick={handleCopy}
            className="w-full group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                {m.emptyState_yourEmail()}
              </p>
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
          <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
            {copied ? m.emptyState_emailCopied() : m.emptyState_clickToCopy()}
          </p>
        </div>
      )}

      {/* Divider */}
      <div
        className="w-full flex items-center gap-3 mb-4"
        style={{ animation: "empty-fade-in-up 500ms ease-out 240ms both" }}
      >
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
          {m.emptyState_or()}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Import CTA */}
      <div
        className="w-full"
        style={{ animation: "empty-fade-in-up 500ms ease-out 300ms both" }}
      >
        <ImportMethodDialog dedicatedEmail={dedicatedEmail}>
          <Button
            variant="outline"
            className="w-full justify-between gap-2 h-11"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              {m.emptyState_importNewsletters()}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Button>
        </ImportMethodDialog>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
          {m.emptyState_importHint()}
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ScrollArea, Button, DialogTrigger } from "@hushletter/ui";
import { Copy, Check, Download, ArrowRight, Mail, Rss, Star, BookOpen } from "lucide-react";
import { SenderAvatar } from "./SenderAvatar";
import { importDialogHandle } from "@/components/import/ImportMethodDialog";
import { m } from "@/paraglide/messages.js";

interface WelcomeReaderPaneProps {
  dedicatedEmail: string | null;
}

const howItWorks = [
  { icon: Rss, text: () => m.welcome_howItWorks_1() },
  { icon: Mail, text: () => m.welcome_howItWorks_2() },
  { icon: Star, text: () => m.welcome_howItWorks_3() },
  { icon: BookOpen, text: () => m.welcome_howItWorks_4() },
] as const;

/**
 * Reader-styled welcome content shown to new users with zero newsletters.
 * Matches the InlineReaderPane layout (flex-1 + ScrollArea) so it sits
 * naturally in the split-pane layout.
 */
export function WelcomeReaderPane({ dedicatedEmail }: WelcomeReaderPaneProps) {
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
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-6 pt-8 pb-12 max-w-2xl mx-auto">
          {/* Sender header */}
          <div className="flex items-center gap-3 mb-8">
            <SenderAvatar
              senderName={m.welcome_senderName()}
              senderEmail="hello@hushletter.com"
              size="lg"
            />
            <div>
              <p className="font-semibold text-foreground">
                {m.welcome_senderName()}
              </p>
              <p className="text-sm text-muted-foreground">
                hello@hushletter.com
              </p>
            </div>
          </div>

          {/* Subject */}
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {m.welcome_subject()}
          </h1>

          <hr className="my-6 border-border" />

          {/* Welcome body */}
          <div className="space-y-6">
            <p className="text-base text-foreground leading-relaxed">
              {m.welcome_greeting()}
            </p>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {m.welcome_intro()}
            </p>

            {/* How it works list */}
            <ul className="space-y-3">
              {howItWorks.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg bg-muted shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-foreground leading-relaxed pt-1">
                    {text()}
                  </span>
                </li>
              ))}
            </ul>

            <hr className="border-border" />

            {/* Dedicated email block */}
            {dedicatedEmail && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {m.welcome_emailSection()}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
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
                <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                  {copied ? m.emptyState_emailCopied() : m.emptyState_clickToCopy()}
                </p>
              </div>
            )}

            <hr className="border-border" />

            {/* Import section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {m.welcome_importSection()}
              </p>
              <DialogTrigger
                handle={importDialogHandle}
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-between gap-2 h-11"
                  />
                }
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {m.emptyState_importNewsletters()}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </DialogTrigger>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                {m.emptyState_importHint()}
              </p>
            </div>

            <hr className="border-border" />

            {/* Getting started tips */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {m.welcome_tipsTitle()}
              </p>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>{m.emptyState_step1()}</li>
                <li>{m.emptyState_step2()}</li>
                <li>{m.emptyState_step3()}</li>
              </ol>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

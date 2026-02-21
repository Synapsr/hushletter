import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { Button, SparklesIcon } from "@hushletter/ui";
import { AlertCircle, RefreshCw, Users, Zap } from "lucide-react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { PricingDialog } from "@/components/pricing-dialog";

interface SummaryPanelProps {
  /** userNewsletter document ID - typed for Convex safety */
  userNewsletterId: Id<"userNewsletters">;
  /** Optional className override for the root Card (used by FloatingSummaryPanel to strip Card chrome) */
  className?: string;
}

/** Summary data from Convex query */
interface SummaryData {
  summary: string | null;
  isShared: boolean;
  generatedAt: number | null;
}

/**
 * SummaryPanel - Displays AI-generated summary for a newsletter
 *
 * Note on useState for isGenerating: This is an ACCEPTED EXCEPTION to project-context.md rules.
 * Convex useAction doesn't provide isPending like useMutation does, so manual loading
 * state management is required here. See ReaderView.tsx for same pattern.
 */
export function SummaryPanel({
  userNewsletterId,
  className,
}: SummaryPanelProps) {
  // Exception: useAction doesn't provide isPending, manual state required
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);

  const { data: entitlements } = useQuery(
    convexQuery(api.entitlements.getEntitlements, {}),
  );
  const isPro = Boolean(
    (entitlements as { isPro?: boolean } | undefined)?.isPro,
  );

  const { data } = useQuery(
    convexQuery(
      api.ai.getNewsletterSummary,
      isPro ? { userNewsletterId } : "skip",
    ),
  );
  const summaryData = data as SummaryData | undefined;

  const generateSummaryAction = useAction(api.ai.generateSummary);

  const handleGenerate = async (forceRegenerate = false) => {
    setIsGenerating(true);
    setError(null);

    try {
      await generateSummaryAction({ userNewsletterId, forceRegenerate });
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string; code?: string };
        setError(data.message ?? m.summaryPanel_failedToGenerate());
      } else {
        setError(m.summaryPanel_failedToGenerateTryAgain());
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const hasSummary = Boolean(summaryData?.summary);
  const isSharedSummary = summaryData?.isShared ?? false;
  const currentReturnPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : undefined;

  return (
    <div className={cn("max-h-[calc(60vh-44px)]", className)}>
      <div className="px-4 py-3">
        {/* Pro upsell */}
        {!isPro && (
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[13px] leading-snug text-foreground/80">
                  AI summaries are included with Hushletter Pro.
                </p>
                <Button size="sm" onClick={() => setIsPricingDialogOpen(true)}>
                  Upgrade to Pro
                </Button>
              </div>
            </div>
            <PricingDialog
              open={isPricingDialogOpen}
              onOpenChange={setIsPricingDialogOpen}
              returnPath={currentReturnPath}
              billingSource="settings_dialog"
            />
          </div>
        )}

        {/* Error state */}
        {isPro && error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-destructive/70"
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-[13px] font-medium text-destructive">
                  {m.summaryPanel_errorTitle()}
                </p>
                <p className="text-xs leading-relaxed text-destructive/70">
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading state — staggered shimmer lines */}
        <AnimatePresence>
          {isPro && isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              aria-label={m.summaryPanel_generatingSummary()}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <SparklesIcon className="size-3.5" aria-hidden="true" />
                </motion.div>
                <span>{m.summaryPanel_generatingSummary()}</span>
              </div>
              <div className="space-y-2.5 pl-1 border-l-2 border-muted-foreground/10 ml-0.5">
                {[100, 88, 72, 56].map((width, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12, duration: 0.3 }}
                    className="h-3 animate-pulse rounded bg-muted"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary content */}
        <AnimatePresence mode="wait">
          {isPro && !isGenerating && hasSummary && summaryData?.summary && (
            <motion.div
              key="summary-content"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {/* Community indicator badge */}
              {isSharedSummary && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Users className="size-3" aria-hidden="true" />
                    {m.summaryPanel_communitySummary()}
                  </span>
                </div>
              )}

              {/* Summary text with editorial left accent */}
              <div className="border-l-2 border-primary/20 pl-3">
                <p className="text-[13px] leading-[1.7] text-foreground/80 whitespace-pre-wrap">
                  {summaryData.summary}
                </p>
              </div>

              {/* Footer: timestamp + regenerate */}
              <div className="flex items-center justify-between pt-1">
                {summaryData.generatedAt ? (
                  <span className="text-[11px] text-muted-foreground/60">
                    {m.summaryPanel_generatedOn({
                      date: new Date(
                        summaryData.generatedAt,
                      ).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }),
                    })}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  {m.summaryPanel_summarize()}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state — generate CTA */}
        {isPro && !isGenerating && !hasSummary && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-3 py-2 text-center"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-muted/50">
              <Zap className="size-4.5 text-muted-foreground/50" aria-hidden="true" />
            </div>
            <p className="max-w-[240px] text-[13px] leading-snug text-muted-foreground/70">
              {m.summaryPanel_emptyStateGuidance()}
            </p>
            <Button
              size="sm"
              onClick={() => handleGenerate(false)}
              disabled={isGenerating}
              className="gap-1.5"
            >
              <SparklesIcon className="size-3.5" aria-hidden="true" />
              {m.summaryPanel_summarize()}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button, ScrollArea, Skeleton } from "@hushletter/ui";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  ReaderView,
  ContentSkeleton,
  clearCacheEntry,
} from "@/components/ReaderView";
import {
  READER_BACKGROUND_OPTIONS,
  useReaderPreferences,
} from "@/hooks/useReaderPreferences";
import { ReaderActionBar } from "./ReaderActionBar";
import { AnimatePresence, motion } from "motion/react";
import { FloatingSummaryPanel } from "./FloatingSummaryPanel";
import { m } from "@/paraglide/messages.js";

interface InlineReaderPaneProps {
  newsletterId: Id<"userNewsletters">;
  getIsFavorited?: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending?: (newsletterId: string) => boolean;
  onToggleFavorite?: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenFullscreen?: () => void;
  isFullscreen?: boolean;
}

interface NewsletterMetadata {
  _id: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isFavorited?: boolean;
  isPrivate: boolean;
  readProgress?: number;
  contentStatus: "available" | "missing" | "error" | "locked";
  source?: "email" | "gmail" | "manual" | "community";
}

// Dev-only debug memory that survives InlineReaderPane remounts when switching newsletters.
const debugResetSkipInitialIds = new Set<string>();
const dismissedReadEstimateIds = new Set<string>();

function ContentErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  console.error("[InlineReader] Content error:", error);
  return (
    <div className="text-center py-12 px-6">
      <p className="text-destructive font-medium mb-2">
        {m.newsletters_failedToLoadContent()}
      </p>
      <Button onClick={resetErrorBoundary}>{m.common_tryAgain()}</Button>
    </div>
  );
}

/**
 * Skeleton that mirrors the exact loaded layout:
 * same action bar dimensions (px-6 py-2 border-b) + same ScrollArea > content wrapper,
 * using the shared ContentSkeleton from ReaderView to avoid layout shifts.
 */
function ReaderSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Action bar skeleton — matches ReaderActionBar's px-6 py-2 border-b */}
      <div className="flex items-center justify-between px-6 py-2 border-b bg-background/95">
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-px" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Content skeleton — matches ScrollArea > .px-6.pt-6.pb-12.max-w-3xl.mx-auto */}
      <div className="flex-1 overflow-hidden px-6 pt-6 pb-12 max-w-3xl mx-auto w-full">
        <ContentSkeleton />
      </div>
    </div>
  );
}

/**
 * Inline reader pane for the split-pane layout.
 * Reuses ReaderView and SummaryPanel from the detail page.
 */
export function InlineReaderPane({
  newsletterId,
  getIsFavorited,
  isFavoritePending,
  onToggleFavorite,
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
  onOpenFullscreen,
  isFullscreen = false,
}: InlineReaderPaneProps) {
  const { preferences, setBackground, setFont, setFontSize } =
    useReaderPreferences();
  const paneBackgroundColor =
    READER_BACKGROUND_OPTIONS[preferences.background].color;
  const paneRef = useRef<HTMLDivElement>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);
  const [isArchivePending, setIsArchivePending] = useState(false);
  const [isReadTogglePending, setIsReadTogglePending] = useState(false);
  const [isBinPending, setIsBinPending] = useState(false);
  const [isDebugResetPending, setIsDebugResetPending] = useState(false);
  const [progressContainerElement, setProgressContainerElement] =
    useState<HTMLElement | null>(null);
  const [debugLiveReadProgress, setDebugLiveReadProgress] = useState<
    number | null
  >(null);
  const [debugProgressResetSignal, setDebugProgressResetSignal] = useState(0);
  const [skipInitialReadProgressCheck, setSkipInitialReadProgressCheck] =
    useState(false);
  const [estimatedReadMinutes, setEstimatedReadMinutes] = useState<
    number | null
  >(null);
  const [isReadEstimateDismissed, setIsReadEstimateDismissed] = useState(false);
  const [isReadMetaHovered, setIsReadMetaHovered] = useState(false);
  const { data: entitlementsData } = useQuery(
    convexQuery(api.entitlements.getEntitlements, {}),
  );
  const entitlements = entitlementsData as { isPro?: boolean } | undefined;
  const isPro = Boolean(entitlements?.isPro);
  const { data, isPending } = useQuery(
    convexQuery(api.newsletters.getUserNewsletter, {
      userNewsletterId: newsletterId,
    }),
  );
  const newsletter = data as NewsletterMetadata | null | undefined;
  const showReadStateDebugOverlay =
    import.meta.env.DEV && import.meta.env.MODE !== "test";

  const hideNewsletter = useMutation(api.newsletters.hideNewsletter);
  const unhideNewsletter = useMutation(api.newsletters.unhideNewsletter);
  const markNewsletterRead = useMutation(api.newsletters.markNewsletterRead);
  const markNewsletterUnread = useMutation(
    api.newsletters.markNewsletterUnread,
  );
  const binNewsletter = useMutation((api.newsletters as any).binNewsletter);
  const setReadProgress = useMutation(api.newsletters.setReadProgress);
  const ensureNewsletterShareToken = useMutation(
    api.share.ensureNewsletterShareToken,
  );

  useEffect(() => {
    setEstimatedReadMinutes(null);
  }, [newsletterId]);

  useEffect(() => {
    setIsReadEstimateDismissed(dismissedReadEstimateIds.has(newsletterId));
    setIsReadMetaHovered(false);
  }, [newsletterId]);

  useEffect(() => {
    setDebugProgressResetSignal(0);
    setSkipInitialReadProgressCheck(
      showReadStateDebugOverlay && debugResetSkipInitialIds.has(newsletterId),
    );
    setDebugLiveReadProgress(null);
  }, [newsletterId, showReadStateDebugOverlay]);

  useEffect(() => {
    let rafId = 0;
    const resolveProgressContainer = () => {
      const viewport = paneRef.current?.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']",
      );
      setProgressContainerElement(viewport ?? null);
    };

    resolveProgressContainer();
    rafId = window.requestAnimationFrame(resolveProgressContainer);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [newsletterId]);

  useEffect(() => {
    if (!isAppearanceOpen) return;

    const handlePointerDownCapture = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const isInsideAppearanceTrigger = Boolean(
        target.closest("[data-slot='popover-trigger']"),
      );
      const isInsideAppearancePopup = Boolean(
        target.closest("[data-slot='popover-popup']"),
      );
      const isInsideAppearanceSelect = Boolean(
        target.closest(
          "[data-slot='select-trigger'], [data-slot='select-content']",
        ),
      );

      if (
        isInsideAppearanceTrigger ||
        isInsideAppearancePopup ||
        isInsideAppearanceSelect
      ) {
        return;
      }

      setIsAppearanceOpen(false);
    };

    const handleWindowBlur = () => {
      setIsAppearanceOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDownCapture, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDownCapture,
        true,
      );
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isAppearanceOpen]);

  if (isPending) {
    return (
      <div
        className="flex-1 min-w-0 overflow-hidden"
        style={{ backgroundColor: paneBackgroundColor }}
      >
        <ReaderSkeleton />
      </div>
    );
  }
  if (!newsletter) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-muted-foreground"
        style={{ backgroundColor: paneBackgroundColor }}
      >
        {m.newsletters_notFound()}
      </div>
    );
  }

  if (newsletter.contentStatus === "locked") {
    return (
      <div
        className="flex-1 flex items-center justify-center p-6"
        style={{ backgroundColor: paneBackgroundColor }}
      >
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Upgrade to read this newsletter
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            You’ve hit the Free plan reading limit. New arrivals are stored but
            locked until you upgrade.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button render={<a href="/settings" />}>Upgrade to Pro</Button>
            <Button variant="outline" render={<a href="/settings" />}>
              View plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleUndoArchive = async () => {
    try {
      await unhideNewsletter({ userNewsletterId: newsletterId });
    } catch (error) {
      console.error(
        "[InlineReaderPane] Failed to restore archived newsletter:",
        error,
      );
      toast.error(m.newsletters_failedToRestore());
    }
  };

  const handleArchive = async () => {
    if (isArchivePending) return;

    setIsArchivePending(true);
    try {
      if (newsletter.isHidden) {
        await unhideNewsletter({ userNewsletterId: newsletterId });
        return;
      }

      await hideNewsletter({ userNewsletterId: newsletterId });
      toast.success(m.newsletters_newsletterHidden(), {
        duration: 5000,
        action: {
          label: m.common_cancel(),
          onClick: () => {
            void handleUndoArchive();
          },
        },
      });
    } catch (error) {
      if (newsletter.isHidden) {
        console.error("[InlineReaderPane] Failed to unhide newsletter:", error);
        toast.error(m.newsletters_failedToRestore());
      } else {
        console.error("[InlineReaderPane] Failed to hide newsletter:", error);
        toast.error(m.newsletters_failedToHide());
      }
    } finally {
      setIsArchivePending(false);
    }
  };

  const handleContentReset = () => {
    clearCacheEntry(newsletterId);
  };

  const date = new Date(newsletter.receivedAt);
  const senderDisplay = newsletter.senderName || newsletter.senderEmail;
  const hasReadEstimate =
    estimatedReadMinutes !== undefined && estimatedReadMinutes !== null;
  console.log({ estimatedReadMinutes });
  const persistedReadProgress =
    typeof newsletter.readProgress === "number" ? newsletter.readProgress : 0;
  const effectiveReadProgress = Math.min(
    100,
    Math.max(
      0,
      typeof debugLiveReadProgress === "number"
        ? debugLiveReadProgress
        : persistedReadProgress,
    ),
  );
  const remainingReadMinutes = hasReadEstimate
    ? (() => {
        const totalMinutes = estimatedReadMinutes;
        if (totalMinutes === null) return null;
        if (totalMinutes < 1) return 0;

        const remainingRatio = 1 - effectiveReadProgress / 100;
        const rawRemainingMinutes = totalMinutes * remainingRatio;
        if (rawRemainingMinutes < 1) return 0;
        return Math.ceil(rawRemainingMinutes);
      })()
    : null;
  const isReadingComplete = newsletter.isRead || effectiveReadProgress >= 100;

  console.log({ isReadingComplete, hasReadEstimate, remainingReadMinutes });
  const readEstimateLabel =
    !isReadingComplete && remainingReadMinutes !== null
      ? remainingReadMinutes < 1
        ? m.reader_minuteRead({ minutes: "<1" })
        : m.reader_minuteRead({ minutes: remainingReadMinutes })
      : null;
  const readingCompleteLabel = isReadingComplete ? "Terminé" : null;
  const readMetaLabel = readEstimateLabel ?? readingCompleteLabel;
  const canRestoreReadEstimate = isReadEstimateDismissed;
  const favoritedValue = getIsFavorited
    ? getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited))
    : Boolean(newsletter.isFavorited);
  const favoritePending = isFavoritePending
    ? isFavoritePending(newsletter._id)
    : false;

  const handleFavoriteToggle = async () => {
    if (!onToggleFavorite || favoritePending) return;
    try {
      await onToggleFavorite(newsletter._id, favoritedValue);
      setFavoriteFeedback(null);
    } catch (error) {
      console.error("[InlineReaderPane] Failed to update favorite:", error);
      setFavoriteFeedback(m.newsletters_favoriteUpdateFailed());
      setTimeout(() => setFavoriteFeedback(null), 2000);
    }
  };

  const handleShare = async () => {
    try {
      const { token } = await ensureNewsletterShareToken({
        userNewsletterId: newsletterId,
      });
      const url = `${window.location.origin}/share/${token}`;

      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
      } catch {
        // Clipboard failures (permissions / unsupported).
        toast.error("Copy failed");
      }
    } catch (error) {
      console.error("[InlineReaderPane] Failed to share newsletter:", error);
      toast.error(m.common_error());
    }
  };

  const handleDebugResetReadState = async () => {
    if (!showReadStateDebugOverlay || isDebugResetPending) return;

    debugResetSkipInitialIds.add(newsletterId);
    setDebugProgressResetSignal((prev) => prev + 1);
    setSkipInitialReadProgressCheck(true);
    setDebugLiveReadProgress(0);

    progressContainerElement?.scrollTo({ top: 0, behavior: "auto" });

    setIsDebugResetPending(true);
    try {
      await setReadProgress({ userNewsletterId: newsletterId, progress: 0 });
      await markNewsletterUnread({ userNewsletterId: newsletterId });
      toast.success("Debug: read state reset");
    } catch {
      toast.error("Debug reset failed");
    } finally {
      setIsDebugResetPending(false);
    }
  };

  const handleToggleRead = async () => {
    if (isReadTogglePending) return;

    setIsReadTogglePending(true);
    try {
      if (newsletter.isRead) {
        await markNewsletterUnread({ userNewsletterId: newsletterId });
        return;
      }
      await markNewsletterRead({ userNewsletterId: newsletterId });
    } catch (error) {
      console.error("[InlineReaderPane] Failed to update read status:", error);
      toast.error(m.common_error());
    } finally {
      setIsReadTogglePending(false);
    }
  };

  const handleBin = async () => {
    if (isBinPending) return;

    setIsBinPending(true);
    try {
      await binNewsletter({ userNewsletterId: newsletterId });
      toast.success("Moved to bin");
    } catch (error) {
      console.error(
        "[InlineReaderPane] Failed to move newsletter to bin:",
        error,
      );
      toast.error("Failed to move newsletter to bin");
    } finally {
      setIsBinPending(false);
    }
  };

  const handleRestoreReadEstimate = () => {
    dismissedReadEstimateIds.delete(newsletterId);
    setIsReadEstimateDismissed(false);
  };

  console.log("effectiveReadProgress", readEstimateLabel);

  return (
    <div
      ref={paneRef}
      className="flex-1 flex flex-col overflow-hidden min-w-0 relative bg-background"
    >
      <ReaderActionBar
        senderName={senderDisplay}
        subject={newsletter.subject}
        date={date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        isRead={newsletter.isRead}
        isHidden={newsletter.isHidden}
        isFavorited={favoritedValue}
        isFavoritePending={favoritePending}
        isArchivePending={isArchivePending}
        onArchive={handleArchive}
        onToggleFavorite={handleFavoriteToggle}
        onShare={handleShare}
        onToggleRead={isReadTogglePending ? undefined : handleToggleRead}
        onBin={handleBin}
        isBinPending={isBinPending}
        preferences={preferences}
        onBackgroundChange={setBackground}
        onFontChange={setFont}
        onFontSizeChange={setFontSize}
        isPro={isPro}
        isAppearanceOpen={isAppearanceOpen}
        onAppearanceOpenChange={setIsAppearanceOpen}
        onToggleSummary={() => setIsSummaryOpen((prev) => !prev)}
        isSummaryOpen={isSummaryOpen}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onOpenFullscreen={onOpenFullscreen}
        isFullscreen={isFullscreen}
        isReadEstimateHidden={canRestoreReadEstimate}
        onShowReadEstimate={handleRestoreReadEstimate}
      />

      <AnimatePresence>
        {isSummaryOpen && (
          <FloatingSummaryPanel
            userNewsletterId={newsletterId}
            onClose={() => setIsSummaryOpen(false)}
            constraintsRef={paneRef}
          />
        )}
      </AnimatePresence>

      {showReadStateDebugOverlay && (
        <div className="absolute right-4 top-14 z-30 rounded-md border border-amber-400/60 bg-amber-50/95 px-2.5 py-1.5 text-[11px] font-mono text-amber-900 shadow-sm">
          <p>
            readProgress:{" "}
            {typeof debugLiveReadProgress === "number"
              ? `${Math.round(debugLiveReadProgress)}%`
              : typeof newsletter.readProgress === "number"
                ? `${Math.round(newsletter.readProgress)}%`
                : "n/a"}
          </p>
          <p>isRead: {newsletter.isRead ? "true" : "false"}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-6 border-amber-400/70 bg-amber-100 px-2 text-[10px] text-amber-900 hover:bg-amber-200"
            disabled={isDebugResetPending}
            onClick={() => void handleDebugResetReadState()}
          >
            {isDebugResetPending ? "Resetting..." : "Reset read + viewed"}
          </Button>
        </div>
      )}

      {favoriteFeedback && (
        <div className="px-6 py-2 text-xs text-destructive" role="status">
          {favoriteFeedback}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {readMetaLabel && !isReadEstimateDismissed && (
          <motion.div
            key={`read-estimate-${newsletterId}`}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-1/2 top-14 z-20 -translate-x-1/2"
          >
            <motion.div
              layout
              onHoverStart={() => {
                setIsReadMetaHovered(true);
              }}
              onHoverEnd={() => {
                setIsReadMetaHovered(false);
              }}
              onFocusCapture={() => {
                setIsReadMetaHovered(true);
              }}
              onBlurCapture={(event) => {
                const nextFocused = event.relatedTarget;
                if (
                  !(nextFocused instanceof Node) ||
                  !event.currentTarget.contains(nextFocused)
                ) {
                  setIsReadMetaHovered(false);
                }
              }}
              className="inline-flex items-center rounded-full border border-border/60 bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
            >
              {isReadingComplete ? (
                <>
                  <span className="font-medium text-foreground">
                    {readingCompleteLabel}
                  </span>
                </>
              ) : (
                <span className="">{readEstimateLabel}</span>
              )}
              <AnimatePresence initial={false}>
                {isReadMetaHovered ? (
                  <motion.div
                    key={`dismiss-read-meta-${newsletterId}`}
                    initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                    animate={{ width: 16, opacity: 1, marginLeft: 4 }}
                    exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <motion.button
                      type="button"
                      aria-label="Hide read time"
                      onClick={() => {
                        dismissedReadEstimateIds.add(newsletterId);
                        setIsReadEstimateDismissed(true);
                      }}
                      className="flex size-4 items-center justify-center rounded-full text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <X className="h-3 w-3" />
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea
        className="flex-1"
        style={{ backgroundColor: paneBackgroundColor }}
        onPointerDownCapture={() => {
          setIsAppearanceOpen(false);
        }}
      >
        {/* Newsletter content */}
        <div
          className="px-6 pt-16 pb-12 max-w-3xl mx-auto "
          onPointerDownCapture={() => {
            setIsAppearanceOpen(false);
          }}
        >
          <ErrorBoundary
            FallbackComponent={ContentErrorFallback}
            onReset={handleContentReset}
          >
            <ReaderView
              userNewsletterId={newsletterId}
              initialProgress={newsletter.readProgress}
              className="max-h-none overflow-visible"
              preferences={preferences}
              onEstimatedReadMinutesChange={setEstimatedReadMinutes}
              onReadProgressChange={setDebugLiveReadProgress}
              progressContainerElement={progressContainerElement}
              progressResetSignal={debugProgressResetSignal}
              skipInitialProgressCheck={skipInitialReadProgressCheck}
            />
          </ErrorBoundary>
        </div>
      </ScrollArea>
    </div>
  );
}

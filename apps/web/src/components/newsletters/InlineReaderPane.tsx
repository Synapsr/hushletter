import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button, ScrollArea, Skeleton } from "@hushletter/ui";
import { toast } from "sonner";
import { ReaderView, clearCacheEntry } from "@/components/ReaderView";
import {
  READER_BACKGROUND_OPTIONS,
  useReaderPreferences,
} from "@/hooks/useReaderPreferences";
import { ReaderActionBar } from "./ReaderActionBar";
import { AnimatePresence } from "motion/react";
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

function ReaderSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header bar */}
      <div className="border-b px-6 py-4 flex items-center gap-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden p-8 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
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
}: InlineReaderPaneProps) {
  const { preferences, setBackground, setFont, setFontSize } =
    useReaderPreferences();
  const paneBackgroundColor =
    READER_BACKGROUND_OPTIONS[preferences.background].color;
  const paneRef = useRef<HTMLDivElement>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);
  const [isArchivePending, setIsArchivePending] = useState(false);
  const [estimatedReadMinutes, setEstimatedReadMinutes] = useState<
    number | null
  >(null);
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

  const hideNewsletter = useMutation(api.newsletters.hideNewsletter);
  const unhideNewsletter = useMutation(api.newsletters.unhideNewsletter);
  const ensureNewsletterShareToken = useMutation(
    api.share.ensureNewsletterShareToken,
  );

  useEffect(() => {
    setEstimatedReadMinutes(null);
  }, [newsletterId]);

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

  return (
    <div
      ref={paneRef}
      className="flex-1 flex flex-col overflow-hidden min-w-0 relative"
      style={{ backgroundColor: paneBackgroundColor }}
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
        estimatedReadMinutes={estimatedReadMinutes ?? undefined}
        preferences={preferences}
        onBackgroundChange={setBackground}
        onFontChange={setFont}
        onFontSizeChange={setFontSize}
        isPro={isPro}
        onToggleSummary={() => setIsSummaryOpen((prev) => !prev)}
        isSummaryOpen={isSummaryOpen}
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

      {favoriteFeedback && (
        <div className="px-6 py-2 text-xs text-destructive" role="status">
          {favoriteFeedback}
        </div>
      )}

      <ScrollArea
        className="flex-1"
        style={{ backgroundColor: paneBackgroundColor }}
      >
        {/* Newsletter header */}
        {/*   <div className="px-6 pt-6 pb-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <SenderAvatar
              senderName={newsletter.senderName}
              senderEmail={newsletter.senderEmail}
              size="lg"
            />
            <div>
              <p className="font-semibold text-foreground">{senderDisplay}</p>
              <p className="text-sm text-muted-foreground">
                <time dateTime={date.toISOString()}>
                  {date.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {newsletter.senderName && (
                  <span> &middot; {newsletter.senderEmail}</span>
                )}
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            {newsletter.subject}
          </h1>

          <hr className="my-6 border-border" />
        </div> */}

        {/* AI Summary */}
        {/* <div className="px-6 max-w-3xl mx-auto">
          <ErrorBoundary FallbackComponent={SummaryErrorFallback}>
            <SummaryPanel userNewsletterId={newsletterId} />
          </ErrorBoundary>
        </div> */}

        {/* Newsletter content */}
        <div className="px-6 pt-6 pb-12 max-w-3xl mx-auto ">
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
            />
          </ErrorBoundary>
        </div>
      </ScrollArea>
    </div>
  );
}

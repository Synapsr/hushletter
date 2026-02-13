import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button, ScrollArea } from "@hushletter/ui";
import { RefreshCw } from "lucide-react";
import { ReaderView, clearCacheEntry } from "@/components/ReaderView";
import { SummaryPanel } from "@/components/SummaryPanel";
import { SenderAvatar } from "./SenderAvatar";
import { ReaderActionBar } from "./ReaderActionBar";
import { m } from "@/paraglide/messages.js";

interface InlineReaderPaneProps {
  newsletterId: Id<"userNewsletters">;
}

interface NewsletterMetadata {
  _id: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isPrivate: boolean;
  readProgress?: number;
  contentStatus: "available" | "missing" | "error";
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

function SummaryErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="mx-6 mb-4 p-4 bg-muted/50 rounded-lg flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {m.newsletters_aiSummaryUnavailable()}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={resetErrorBoundary}
        className="gap-1"
      >
        <RefreshCw className="h-3 w-3" />
        {m.newsletters_retry()}
      </Button>
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="flex-1 animate-pulse p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-40" />
          <div className="h-3 bg-muted rounded w-56" />
        </div>
      </div>
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="space-y-3 pt-4">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
    </div>
  );
}

/**
 * Inline reader pane for the split-pane layout.
 * Reuses ReaderView and SummaryPanel from the detail page.
 */
export function InlineReaderPane({ newsletterId }: InlineReaderPaneProps) {
  const { data, isPending } = useQuery(
    convexQuery(api.newsletters.getUserNewsletter, {
      userNewsletterId: newsletterId,
    }),
  );
  const newsletter = data as NewsletterMetadata | null | undefined;

  const hideNewsletter = useMutation(api.newsletters.hideNewsletter);
  const markRead = useMutation(api.newsletters.markNewsletterRead);

  if (isPending) return <ReaderSkeleton />;
  if (!newsletter) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {m.newsletters_notFound()}
      </div>
    );
  }

  const handleArchive = () => {
    hideNewsletter({ userNewsletterId: newsletterId });
  };

  const handleReadingComplete = () => {
    markRead({ userNewsletterId: newsletterId, readProgress: 100 });
  };

  const handleContentReset = () => {
    clearCacheEntry(newsletterId);
  };

  const date = new Date(newsletter.receivedAt);
  const senderDisplay = newsletter.senderName || newsletter.senderEmail;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <ReaderActionBar
        isRead={newsletter.isRead}
        isHidden={newsletter.isHidden}
        onArchive={handleArchive}
        estimatedReadMinutes={8}
      />

      <ScrollArea className="flex-1">
        {/* Newsletter header */}
        <div className="px-6 pt-6 pb-4 max-w-3xl mx-auto">
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
        </div>

        {/* AI Summary */}
        <div className="px-6 max-w-3xl mx-auto">
          <ErrorBoundary FallbackComponent={SummaryErrorFallback}>
            <SummaryPanel userNewsletterId={newsletterId} />
          </ErrorBoundary>
        </div>

        {/* Newsletter content */}
        <div className="px-6 pb-12 max-w-3xl mx-auto">
          <ErrorBoundary
            FallbackComponent={ContentErrorFallback}
            onReset={handleContentReset}
          >
            <ReaderView
              userNewsletterId={newsletterId}
              initialProgress={newsletter.readProgress}
              onReadingComplete={handleReadingComplete}
              className="max-h-none overflow-visible"
            />
          </ErrorBoundary>
        </div>
      </ScrollArea>
    </div>
  );
}

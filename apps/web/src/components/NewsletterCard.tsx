import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { Button, Card, CardContent, Tooltip, TooltipTrigger, TooltipContent } from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { EyeOff, Eye, Sparkles, Lock, Mail, Globe } from "lucide-react";
import { SummaryPreview } from "./SummaryPreview";
import { m } from "@/paraglide/messages.js";

/** Newsletter data from listUserNewsletters query */
export interface NewsletterData {
  _id: Id<"userNewsletters">;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isRead: boolean;
  isHidden: boolean;
  isPrivate: boolean;
  readProgress?: number;
  /** Story 5.2: Indicates if AI summary is available */
  hasSummary?: boolean;
  /** Story 9.10: Newsletter source for unified folder view display */
  source?: "email" | "gmail" | "manual" | "community";
}

interface NewsletterCardProps {
  newsletter: NewsletterData;
  /** Story 3.5: Whether to show "Unhide" instead of "Hide" action */
  showUnhide?: boolean;
  /** When provided, intercepts click to select inline instead of navigating */
  onSelect?: (id: string) => void;
}

/**
 * Format Unix timestamp for display using user's locale
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Show relative time for recent newsletters
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return m.time_justNow();
      return m.time_minutesAgo({ minutes: diffMinutes });
    }
    return m.time_hoursAgo({ hours: diffHours });
  }

  if (diffDays === 1) return m.time_yesterday();
  if (diffDays < 7) return m.time_daysAgo({ days: diffDays });

  // Show full date for older newsletters
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get display name for sender (name or fallback to email)
 */
function getSenderDisplay(newsletter: NewsletterData): string {
  return newsletter.senderName || newsletter.senderEmail;
}

/**
 * Story 9.10: Get source indicator info for newsletter display
 * Private sources (email, gmail, manual) show envelope icon
 * Community source shows globe icon
 */
function getSourceIndicatorInfo(source?: NewsletterData["source"]) {
  if (source === "community") {
    return {
      Icon: Globe,
      label: m.newsletters_fromCommunity(),
      tooltip: "This newsletter was imported from the community library",
      className: "text-blue-500",
    };
  }
  // Default to private indicator for email/gmail/manual/undefined
  return {
    Icon: Mail,
    label: m.newsletters_private(),
    tooltip: m.newsletters_privateTooltip(),
    className: "text-muted-foreground",
  };
}

/**
 * NewsletterCard - Displays a newsletter list item with sender, subject, and date
 * Story 3.4: Shows read/unread status with visual distinction and progress indicator (AC5)
 * Story 3.5: AC1 - Hide action on hover, AC4 - Unhide action for hidden newsletters
 * Story 5.2: Task 1-3 - Summary indicator and preview
 */
export function NewsletterCard({ newsletter, showUnhide = false, onSelect }: NewsletterCardProps) {
  const senderDisplay = getSenderDisplay(newsletter);
  // Story 9.10 (code review fix): Extract source info computation from IIFE in JSX
  const sourceInfo = getSourceIndicatorInfo(newsletter.source);

  // Code review fix (HIGH-1): Track feedback state for AC1 confirmation
  const [feedback, setFeedback] = useState<string | null>(null);
  // Story 5.2: Track summary preview expansion state
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);

  // Story 3.5: Hide/unhide mutations
  const hideNewsletter = useMutation(api.newsletters.hideNewsletter);
  const unhideNewsletter = useMutation(api.newsletters.unhideNewsletter);

  // Story 3.4 AC5: Show progress for partially read newsletters (0 < progress < 100)
  const isPartiallyRead =
    newsletter.readProgress !== undefined &&
    newsletter.readProgress > 0 &&
    newsletter.readProgress < 100;

  // Story 3.5: Handle hide/unhide with event stopping to prevent navigation
  // Code review fix (HIGH-1): Added feedback for AC1 confirmation requirement
  const handleHideClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setFeedback(m.newsletterCard_hiding());
      await hideNewsletter({ userNewsletterId: newsletter._id });
      // Note: Item will disappear from list due to Convex reactivity - that's the primary feedback
      // The "Hiding..." text provides immediate feedback before the item disappears
    } catch (error) {
      console.error("[NewsletterCard] Failed to hide newsletter:", error);
      setFeedback(m.newsletterCard_failed());
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleUnhideClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setFeedback(m.newsletterCard_restoring());
      await unhideNewsletter({ userNewsletterId: newsletter._id });
      setFeedback(m.newsletterCard_restored());
      setTimeout(() => setFeedback(null), 1500);
    } catch (error) {
      console.error("[NewsletterCard] Failed to unhide newsletter:", error);
      setFeedback(m.newsletterCard_failed());
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleClick = onSelect
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        onSelect(newsletter._id);
      }
    : undefined;

  return (
    <Link
      to="/newsletters/$id"
      params={{ id: newsletter._id }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
      onClick={handleClick}
    >
      <Card
        className={cn(
          "transition-colors hover:bg-accent/50 cursor-pointer",
          !newsletter.isRead && "border-l-4 border-l-primary",
        )}
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            {/* Story 3.4 AC5: Unread indicator dot */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {!newsletter.isRead && (
                <div className="h-2 w-2 rounded-full bg-primary/60 mt-2 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {/* Sender name/email */}
                <p
                  className={cn(
                    "text-sm truncate",
                    newsletter.isRead ? "text-muted-foreground" : "font-semibold text-foreground",
                  )}
                >
                  {senderDisplay}
                </p>
                {/* Subject line */}
                <p
                  className={cn(
                    "text-base truncate mt-1",
                    newsletter.isRead ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {newsletter.subject}
                </p>
              </div>
            </div>
            {/* Date, summary indicator, progress indicator, feedback, and hide action */}
            <div className="flex items-start gap-2 flex-shrink-0">
              <div className="flex flex-col items-end gap-1">
                {/* Date, source indicator, privacy indicator, and summary indicator row */}
                <div className="flex items-center gap-1.5">
                  {/* Story 9.10: Source indicator - shows newsletter origin */}
                  <Tooltip>
                    <TooltipTrigger className="inline-flex">
                      <sourceInfo.Icon
                        className={cn("h-3.5 w-3.5", sourceInfo.className)}
                        aria-label={sourceInfo.label}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{sourceInfo.tooltip}</TooltipContent>
                  </Tooltip>
                  {/* Story 6.2: Privacy indicator - lock icon for private newsletters */}
                  {newsletter.isPrivate && (
                    <Tooltip>
                      <TooltipTrigger className="inline-flex">
                        <Lock
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-label="Private newsletter"
                        />
                      </TooltipTrigger>
                      <TooltipContent>This newsletter is private and not shared with the community</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Story 5.2: Summary indicator - clickable to toggle preview */}
                  {newsletter.hasSummary && (
                    <button
                      type="button"
                      className="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
                      title={m.newsletterCard_summaryPreviewAria()}
                      aria-label={
                        showSummaryPreview ? "Hide summary preview" : "Show summary preview"
                      }
                      aria-expanded={showSummaryPreview}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSummaryPreview(!showSummaryPreview);
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  {/* Code review fix (HIGH-1): Show feedback when action in progress */}
                  {feedback ? (
                    <span className="text-xs text-muted-foreground animate-pulse" role="status">
                      {feedback}
                    </span>
                  ) : (
                    <time
                      dateTime={new Date(newsletter.receivedAt).toISOString()}
                      className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                      {formatDate(newsletter.receivedAt)}
                    </time>
                  )}
                </div>
                {/* Story 3.4 AC5: Progress indicator for partially read */}
                {isPartiallyRead && !feedback && (
                  <span className="text-xs text-muted-foreground">
                    {m.newsletters_readProgress({ progress: newsletter.readProgress ?? 0 })}
                  </span>
                )}
              </div>
              {/* Story 3.5: Hide/Unhide button - appears on hover (AC1, AC4)
                  Code review fix (MEDIUM-3): Always visible on touch devices (md:opacity-0)
                  since hover states don't work on mobile */}
              {showUnhide ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-100"
                  onClick={handleUnhideClick}
                  aria-label={m.newsletterCard_unhideAria()}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-50 md:opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleHideClick}
                  aria-label={m.newsletterCard_hideAria()}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Story 5.2: Summary preview - shown when user clicks indicator */}
          {showSummaryPreview && newsletter.hasSummary && (
            <SummaryPreview userNewsletterId={newsletter._id as Id<"userNewsletters">} />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import { Badge, Button, Card, CardContent, Checkbox } from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { Sparkles, Users, Lock, Download, Check } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/**
 * Community newsletter data from listCommunityNewsletters query
 * Story 6.1: Task 2.2
 * Story 9.8: Added importCount field
 *
 * PRIVACY: This type contains ONLY public fields from newsletterContent.
 * No user-specific data (userId, isRead, isHidden, etc.) is ever included.
 */
export interface CommunityNewsletterData {
  _id: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  firstReceivedAt: number;
  readerCount: number;
  importCount?: number; // Story 9.8: How many users imported from community
  hasSummary: boolean;
}

/**
 * Ownership status for a community newsletter
 * Story 9.8 Task 3.3-3.4
 */
export interface OwnershipStatus {
  hasPrivate: boolean; // User received this newsletter privately
  hasImported: boolean; // User imported this from community
}

interface CommunityNewsletterCardProps {
  newsletter: CommunityNewsletterData;
  ownershipStatus?: OwnershipStatus; // Story 9.8 Task 3.3-3.4
  onPreviewClick?: () => void; // Story 9.8 Task 5.1: Click to preview
  // Story 9.9 Task 5.2, 6.1-6.4: Selection mode and quick import
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onQuickImport?: () => void;
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
      if (diffMinutes < 1) return m.communityCard_timeJustNow();
      return m.communityCard_timeMinutesAgo({ minutes: diffMinutes });
    }
    return m.communityCard_timeHoursAgo({ hours: diffHours });
  }

  if (diffDays === 1) return m.communityCard_timeYesterday();
  if (diffDays < 7) return m.communityCard_timeDaysAgo({ days: diffDays });

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
function getSenderDisplay(newsletter: CommunityNewsletterData): string {
  return newsletter.senderName || newsletter.senderEmail;
}

/**
 * Format reader count for display
 * Story 6.1: Task 2.2 - Shows "X readers" badge
 */
function formatReaderCount(count: number): string {
  if (count === 1) return m.communityCard_readersSingular();
  if (count >= 1000) {
    return m.communityCard_readersThousands({ count: (count / 1000).toFixed(1) });
  }
  return m.communityCard_readersPlural({ count });
}

/**
 * Format import count for display
 * Story 9.8 Task 6.2 - Shows "X imports" badge
 */
function formatImportCount(count: number): string {
  if (count === 0) return "";
  if (count === 1) return m.communityCard_importsSingular();
  if (count >= 1000) {
    return m.communityCard_importsThousands({ count: (count / 1000).toFixed(1) });
  }
  return m.communityCard_importsPlural({ count });
}

/**
 * CommunityNewsletterCard - Displays a community newsletter in the browse list
 * Story 6.1: Task 2.2
 * Story 9.8: Added ownership badges, import count, preview click handler
 *
 * Shows:
 * - Subject line
 * - Sender name/email
 * - First received date
 * - Reader count badge ("X readers")
 * - Import count badge ("X imports") - Story 9.8 Task 6.2
 * - Summary indicator if available
 * - Ownership badges ("In your collection", "Already imported") - Story 9.8 Task 3.3-3.4
 *
 * PRIVACY: This component displays ONLY public data.
 * No read status, hide status, or user-specific actions are shown.
 */
export function CommunityNewsletterCard({
  newsletter,
  ownershipStatus,
  onPreviewClick,
  selectionMode,
  isSelected,
  onSelectionChange,
  onQuickImport,
}: CommunityNewsletterCardProps) {
  const senderDisplay = getSenderDisplay(newsletter);

  // Story 9.8: Determine if user already has this newsletter
  const alreadyOwned = ownershipStatus?.hasPrivate || ownershipStatus?.hasImported;

  // Story 9.8 Task 5.1: Handle card click for preview
  const handleClick = (e: React.MouseEvent) => {
    // Story 9.9 Task 5.2: In selection mode, toggle selection instead of preview
    if (selectionMode && onSelectionChange) {
      e.preventDefault();
      e.stopPropagation();
      onSelectionChange(!isSelected);
      return;
    }
    if (onPreviewClick) {
      e.preventDefault();
      onPreviewClick();
    }
  };

  // Story 9.9 Task 5.2: Handle checkbox change
  const handleCheckboxChange = (checked: boolean | "indeterminate") => {
    if (onSelectionChange && typeof checked === "boolean") {
      onSelectionChange(checked);
    }
  };

  // Story 9.9 Task 6.1: Handle quick import
  const handleQuickImport = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickImport) {
      onQuickImport();
    }
  };

  const cardContent = (
    <Card
      className={cn(
        "transition-colors hover:bg-accent/50 cursor-pointer",
        alreadyOwned && "opacity-80",
        isSelected && "ring-2 ring-primary",
      )}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Story 9.9 Task 5.2: Selection checkbox */}
          {selectionMode && !alreadyOwned && (
            <div
              className="shrink-0 pt-1"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                aria-label={m.communityCard_ariaSelectNewsletter({ subject: newsletter.subject })}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {/* Sender name/email */}
            <p className="text-sm text-muted-foreground truncate">{senderDisplay}</p>
            {/* Subject line */}
            <p className="text-base font-medium text-foreground truncate mt-1">
              {newsletter.subject}
            </p>

            {/* Story 9.8 Task 3.3-3.4: Ownership indicators */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ownershipStatus?.hasPrivate && (
                <Badge variant="secondary" className="text-xs py-0 h-5">
                  <Lock className="h-3 w-3 mr-1" aria-hidden="true" />
                  {m.communityCard_badgeInCollection()}
                </Badge>
              )}
              {ownershipStatus?.hasImported && !ownershipStatus?.hasPrivate && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  <Download className="h-3 w-3 mr-1" aria-hidden="true" />
                  {m.communityCard_badgeAlreadyImported()}
                </Badge>
              )}

              {/* Story 9.8 Task 6.2: Import count badge */}
              {(newsletter.importCount ?? 0) > 0 && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  <Download className="h-3 w-3 mr-1" aria-hidden="true" />
                  {formatImportCount(newsletter.importCount ?? 0)}
                </Badge>
              )}
            </div>
          </div>
          {/* Date, reader count, actions, and summary indicator */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Story 9.9 Task 6.1-6.2: Quick import button or "In Collection" badge */}
            {!selectionMode && (
              <div className="mb-1">
                {alreadyOwned ? (
                  <Badge variant="secondary" className="text-xs py-0.5 px-2">
                    <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                    {m.communityCard_badgeInCollectionShort()}
                  </Badge>
                ) : onQuickImport ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleQuickImport}
                  >
                    <Download className="h-3 w-3 mr-1" aria-hidden="true" />
                    {m.communityCard_buttonImport()}
                  </Button>
                ) : null}
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Summary indicator */}
              {newsletter.hasSummary && (
                <span
                  className="flex items-center text-amber-500"
                  title={m.communityCard_summaryAvailableTitle()}
                  aria-label={m.communityCard_summaryAvailableAria()}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
              {/* Date */}
              <time
                dateTime={new Date(newsletter.firstReceivedAt).toISOString()}
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {formatDate(newsletter.firstReceivedAt)}
              </time>
            </div>
            {/* Reader count badge */}
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                newsletter.readerCount > 10 ? "text-primary" : "text-muted-foreground",
              )}
              title={m.communityCard_readersTooltip({ count: newsletter.readerCount })}
            >
              <Users className="h-3 w-3" aria-hidden="true" />
              <span>{formatReaderCount(newsletter.readerCount)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Story 9.8 Task 5.1: If preview click handler is provided, use button instead of Link
  if (onPreviewClick) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <Link
      to="/community/$contentId"
      params={{ contentId: newsletter._id }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
    >
      {cardContent}
    </Link>
  );
}

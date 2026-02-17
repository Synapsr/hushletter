import { useState } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { NewsletterData } from "@/components/NewsletterCard";
import { Check, EyeOff, LockKeyhole, RotateCcw, Star, Trash2 } from "lucide-react";

interface NewsletterListItemProps {
  newsletter: NewsletterData;
  isSelected: boolean;
  isFavorited: boolean;
  isFavoritePending: boolean;
  enableHideAction?: boolean;
  onHide?: (newsletterId: string) => void;
  onClick: (id: string) => void;
  onToggleFavorite: (newsletterId: string, currentValue: boolean) => Promise<void>;
  onToggleRead?: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  onArchive?: (newsletterId: string) => Promise<void>;
  onBin?: (newsletterId: string) => Promise<void>;
}

/**
 * Format timestamp as relative time for sidebar display.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return m.time_justNow();
  if (diffHours < 24) return m.time_hoursAgo({ hours: diffHours });
  if (diffDays === 1) return m.time_yesterday();
  if (diffDays < 7) return m.time_daysAgo({ days: diffDays });

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Compact newsletter row for the sender folder sidebar.
 * Shows title (bold if unread), preview snippet, and relative time.
 */
export function NewsletterListItem({
  newsletter,
  isSelected,
  isFavorited,
  isFavoritePending,
  enableHideAction = false,
  onHide,
  onClick,
  onToggleFavorite,
  onToggleRead,
  onArchive,
  onBin,
}: NewsletterListItemProps) {
  const [pendingAction, setPendingAction] = useState<
    "favorite" | "read" | "archive" | "bin" | null
  >(null);
  const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);

  const handleFavoriteClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isFavoritePending || pendingAction !== null) return;

    try {
      setPendingAction("favorite");
      await onToggleFavorite(newsletter._id, isFavorited);
      setFavoriteFeedback(null);
    } catch (error) {
      console.error("[NewsletterListItem] Failed to update favorite:", error);
      setFavoriteFeedback(m.newsletters_favoriteUpdateFailed());
      setTimeout(() => setFavoriteFeedback(null), 2000);
    } finally {
      setPendingAction(null);
    }
  };

  const handleArchiveClick = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (pendingAction !== null) return;

    if (enableHideAction && !newsletter.isHidden && onHide) {
      onHide(newsletter._id);
      return;
    }

    if (!onArchive) return;

    try {
      setPendingAction("archive");
      await onArchive(newsletter._id);
    } catch (error) {
      console.error("[NewsletterListItem] Failed to archive newsletter:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleReadClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onToggleRead || pendingAction !== null) return;

    try {
      setPendingAction("read");
      await onToggleRead(newsletter._id, Boolean(newsletter.isRead));
    } catch (error) {
      console.error("[NewsletterListItem] Failed to toggle read status:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleBinClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onBin || pendingAction !== null) return;

    try {
      setPendingAction("bin");
      await onBin(newsletter._id);
    } catch (error) {
      console.error("[NewsletterListItem] Failed to move newsletter to bin:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const showReadAction = Boolean(onToggleRead);
  const showArchiveAction =
    !newsletter.isHidden && (enableHideAction || Boolean(onArchive));
  const showBinAction = Boolean(onBin);
  const hasQuickActions = showReadAction || showArchiveAction || showBinAction;

  const quickActionButtonClass = cn(
    "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
    "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

  return (
    <div
      className={cn(
        "group/news-item relative w-full px-3 py-2 rounded-md transition-colors",
        "hover:bg-accent/60",
        isSelected && "bg-accent",
        !newsletter.isRead && "font-medium",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onClick(newsletter._id)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm truncate flex-1",
                newsletter.isRead ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1 min-w-0">
                {newsletter.isLockedByPlan && (
                  <LockKeyhole className="h-3.5 w-3.5 text-violet-500 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{newsletter.subject}</span>
              </span>
            </p>
            <time className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
              {formatRelativeTime(newsletter.receivedAt)}
            </time>
          </div>
          {/* Preview snippet - first part of subject or sender info */}
          {newsletter.senderName && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {newsletter.senderName}
            </p>
          )}
          {favoriteFeedback && (
            <p className="text-[11px] text-destructive mt-1" role="status">
              {favoriteFeedback}
            </p>
          )}
        </button>
      </div>

      <div
        className={cn(
          "absolute top-1.5 right-2 z-10 flex items-center gap-1 rounded-full border bg-background/95 p-1 shadow-xs transition-opacity",
          "opacity-100 md:opacity-0",
          "md:pointer-events-none md:group-hover/news-item:pointer-events-auto",
          "md:group-hover/news-item:opacity-100",
          isSelected && "opacity-100 pointer-events-auto",
        )}
      >
        <button
          type="button"
          className={cn(
            quickActionButtonClass,
            "hover:text-yellow-500",
            isFavorited && "text-yellow-500",
            (isFavoritePending || pendingAction !== null) &&
              "opacity-50 cursor-not-allowed",
          )}
          aria-label={
            isFavorited
              ? m.newsletters_removeFromFavoritesAria()
              : m.newsletters_addToFavoritesAria()
          }
          aria-pressed={isFavorited}
          disabled={isFavoritePending || pendingAction !== null}
          onClick={handleFavoriteClick}
        >
          <Star className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
        </button>

        {showReadAction && (
          <button
            type="button"
            className={cn(
              quickActionButtonClass,
              pendingAction !== null && "opacity-50 cursor-not-allowed",
            )}
            aria-label={
              newsletter.isRead
                ? m.newsletters_markUnread()
                : m.newsletters_markAsRead()
            }
            disabled={pendingAction !== null}
            onClick={handleReadClick}
          >
            {newsletter.isRead ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {showArchiveAction && (
          <button
            type="button"
            className={cn(
              quickActionButtonClass,
              pendingAction !== null && "opacity-50 cursor-not-allowed",
            )}
            aria-label={m.newsletters_hide()}
            disabled={pendingAction !== null}
            onClick={(event) => {
              void handleArchiveClick(event);
            }}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}

        {hasQuickActions && showBinAction && (
          <button
            type="button"
            className={cn(
              quickActionButtonClass,
              "hover:text-destructive",
              pendingAction !== null && "opacity-50 cursor-not-allowed",
            )}
            aria-label={m.bin_label?.() ?? "Bin"}
            disabled={pendingAction !== null}
            onClick={(event) => {
              void handleBinClick(event);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { NewsletterData } from "@/components/NewsletterCard";

interface NewsletterListItemProps {
  newsletter: NewsletterData;
  isSelected: boolean;
  onClick: (id: string) => void;
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
  onClick,
}: NewsletterListItemProps) {
  return (
    <button
      onClick={() => onClick(newsletter._id)}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md transition-colors",
        "hover:bg-accent/60",
        isSelected && "bg-accent",
        !newsletter.isRead && "font-medium",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-sm truncate flex-1",
            newsletter.isRead ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {newsletter.subject}
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
    </button>
  );
}

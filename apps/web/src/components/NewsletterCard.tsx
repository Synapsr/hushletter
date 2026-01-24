import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

/** Newsletter data from listUserNewsletters query */
export interface NewsletterData {
  _id: string
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: number
  isRead: boolean
  isHidden: boolean
  isPrivate: boolean
  readProgress?: number
}

interface NewsletterCardProps {
  newsletter: NewsletterData
}

/**
 * Format Unix timestamp for display using user's locale
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Show relative time for recent newsletters
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes < 1) return "Just now"
      return `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }

  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`

  // Show full date for older newsletters
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Get display name for sender (name or fallback to email)
 */
function getSenderDisplay(newsletter: NewsletterData): string {
  return newsletter.senderName || newsletter.senderEmail
}

/**
 * NewsletterCard - Displays a newsletter list item with sender, subject, and date
 * Story 3.4: Shows read/unread status with visual distinction and progress indicator (AC5)
 */
export function NewsletterCard({ newsletter }: NewsletterCardProps) {
  const senderDisplay = getSenderDisplay(newsletter)

  // Story 3.4 AC5: Show progress for partially read newsletters (0 < progress < 100)
  const isPartiallyRead =
    newsletter.readProgress !== undefined &&
    newsletter.readProgress > 0 &&
    newsletter.readProgress < 100

  return (
    <Link
      to="/newsletters/$id"
      params={{ id: newsletter._id }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card
        className={cn(
          "transition-colors hover:bg-accent/50 cursor-pointer",
          !newsletter.isRead && "border-l-4 border-l-primary"
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
                    newsletter.isRead
                      ? "text-muted-foreground"
                      : "font-semibold text-foreground"
                  )}
                >
                  {senderDisplay}
                </p>
                {/* Subject line */}
                <p
                  className={cn(
                    "text-base truncate mt-1",
                    newsletter.isRead
                      ? "text-muted-foreground"
                      : "font-medium text-foreground"
                  )}
                >
                  {newsletter.subject}
                </p>
              </div>
            </div>
            {/* Date and progress indicator */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <time
                dateTime={new Date(newsletter.receivedAt).toISOString()}
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {formatDate(newsletter.receivedAt)}
              </time>
              {/* Story 3.4 AC5: Progress indicator for partially read */}
              {isPartiallyRead && (
                <span className="text-xs text-muted-foreground">
                  {newsletter.readProgress}% read
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import { Sparkles, Users } from "lucide-react"

/**
 * Community newsletter data from listCommunityNewsletters query
 * Story 6.1: Task 2.2
 *
 * PRIVACY: This type contains ONLY public fields from newsletterContent.
 * No user-specific data (userId, isRead, isHidden, etc.) is ever included.
 */
export interface CommunityNewsletterData {
  _id: string
  subject: string
  senderEmail: string
  senderName?: string
  firstReceivedAt: number
  readerCount: number
  hasSummary: boolean
}

interface CommunityNewsletterCardProps {
  newsletter: CommunityNewsletterData
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
function getSenderDisplay(newsletter: CommunityNewsletterData): string {
  return newsletter.senderName || newsletter.senderEmail
}

/**
 * Format reader count for display
 * Story 6.1: Task 2.2 - Shows "X readers" badge
 */
function formatReaderCount(count: number): string {
  if (count === 1) return "1 reader"
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k readers`
  }
  return `${count} readers`
}

/**
 * CommunityNewsletterCard - Displays a community newsletter in the browse list
 * Story 6.1: Task 2.2
 *
 * Shows:
 * - Subject line
 * - Sender name/email
 * - First received date
 * - Reader count badge ("X readers")
 * - Summary indicator if available
 *
 * PRIVACY: This component displays ONLY public data.
 * No read status, hide status, or user-specific actions are shown.
 */
export function CommunityNewsletterCard({ newsletter }: CommunityNewsletterCardProps) {
  const senderDisplay = getSenderDisplay(newsletter)

  return (
    <Link
      to="/community/$contentId"
      params={{ contentId: newsletter._id }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
    >
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Sender name/email */}
              <p className="text-sm text-muted-foreground truncate">
                {senderDisplay}
              </p>
              {/* Subject line */}
              <p className="text-base font-medium text-foreground truncate mt-1">
                {newsletter.subject}
              </p>
            </div>
            {/* Date, reader count, and summary indicator */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-2">
                {/* Summary indicator */}
                {newsletter.hasSummary && (
                  <span
                    className="flex items-center text-amber-500"
                    title="AI summary available"
                    aria-label="Has AI summary"
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
                  newsletter.readerCount > 10
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                title={`${newsletter.readerCount} readers have this newsletter`}
              >
                <Users className="h-3 w-3" aria-hidden="true" />
                <span>{formatReaderCount(newsletter.readerCount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

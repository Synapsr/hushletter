import { Mail } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { m } from "@/paraglide/messages.js"

/**
 * Activity item data structure
 */
interface ActivityItem {
  /** Type of activity */
  type: "newsletter"
  /** Subject line of the newsletter */
  subject: string
  /** Email address of the sender */
  senderEmail: string
  /** Unix timestamp in milliseconds */
  timestamp: number
}

/**
 * Props for the RecentActivityFeed component
 * Story 7.1: Task 3.4 - Activity list
 */
interface RecentActivityFeedProps {
  /** List of recent activity items */
  items: ActivityItem[]
}

/**
 * RecentActivityFeed displays a list of recent platform activities
 * Story 7.1: Task 3.4
 *
 * Shows newsletter arrivals with:
 * - Subject line
 * - Sender email
 * - Time ago
 *
 * @example
 * <RecentActivityFeed items={[
 *   { type: "newsletter", subject: "Weekly Update", senderEmail: "news@example.com", timestamp: 1737795600000 }
 * ]} />
 */
export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        {m.recentActivity_noActivity()}
      </p>
    )
  }

  return (
    <ul className="space-y-3" aria-label={m.recentActivity_listLabel()}>
      {items.map((item, index) => (
        <li
          key={`${item.timestamp}-${index}`}
          className="flex items-start gap-3 py-2 border-b last:border-0"
        >
          <div
            className="rounded-full bg-muted p-2 shrink-0"
            aria-hidden="true"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.subject}</p>
            <p className="text-xs text-muted-foreground">
              {m.recentActivity_fromSender({ email: item.senderEmail })}
            </p>
          </div>
          <time
            className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
            dateTime={new Date(item.timestamp).toISOString()}
            aria-label={m.recentActivity_receivedLabel({ timeAgo: formatDistanceToNow(item.timestamp, { addSuffix: true }) })}
          >
            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
          </time>
        </li>
      ))}
    </ul>
  )
}

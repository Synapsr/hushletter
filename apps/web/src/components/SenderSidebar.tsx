import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { cn } from "~/lib/utils"

/**
 * Sender data from listSendersForUserWithUnreadCounts query
 */
export interface SenderData {
  _id: string
  email: string
  name?: string
  displayName: string
  domain: string
  userNewsletterCount: number
  unreadCount: number
  isPrivate: boolean
  folderId?: string
}

interface SenderSidebarProps {
  selectedSenderId: string | null
  onSenderSelect: (senderId: string | null) => void
  totalNewsletterCount: number
  totalUnreadCount: number
}

/**
 * Loading skeleton for SenderSidebar
 * Task 2: Shows while sender data is loading
 */
export function SenderSidebarSkeleton() {
  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1">
      <div className="h-10 bg-muted rounded-lg animate-pulse" />
      <div className="h-px bg-border my-2" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
      ))}
    </aside>
  )
}

/**
 * SenderSidebar - Navigation sidebar listing senders with newsletter counts
 * Story 3.1: Task 1-3 (AC1, AC2, AC3, AC4)
 *
 * Features:
 * - "All Newsletters" item at top with total count
 * - Alphabetically sorted sender list
 * - Newsletter count badges per sender
 * - Subtle unread indicators (UX compliant - not anxiety-inducing)
 * - Visual highlighting for selected sender
 */
export function SenderSidebar({
  selectedSenderId,
  onSenderSelect,
  totalNewsletterCount,
  totalUnreadCount,
}: SenderSidebarProps) {
  // Real-time subscription to senders with unread counts
  const { data: senders, isPending } = useQuery(
    convexQuery(api.senders.listSendersForUserWithUnreadCounts, {})
  )

  if (isPending) return <SenderSidebarSkeleton />

  const senderList = (senders ?? []) as SenderData[]

  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1 overflow-y-auto">
      {/* "All Newsletters" item - Task 3 (AC3) */}
      <button
        onClick={() => onSenderSelect(null)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
          "hover:bg-accent transition-colors",
          !selectedSenderId && "bg-accent font-medium"
        )}
      >
        <span>All Newsletters</span>
        <div className="flex items-center gap-2">
          {/* Subtle unread indicator (UX compliant) */}
          {totalUnreadCount > 0 && (
            <span
              className="h-2 w-2 rounded-full bg-primary/60"
              aria-label={`${totalUnreadCount} unread`}
            />
          )}
          <span className="text-muted-foreground text-xs">
            {totalNewsletterCount}
          </span>
        </div>
      </button>

      <div className="h-px bg-border my-2" />

      {/* Sender list - Task 1 (AC1, AC2, AC4) */}
      {senderList.map((sender) => (
        <button
          key={sender._id}
          onClick={() => onSenderSelect(sender._id)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
            "hover:bg-accent transition-colors text-left",
            selectedSenderId === sender._id && "bg-accent font-medium"
          )}
        >
          <span className="truncate flex-1 mr-2">{sender.displayName}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Subtle unread indicator (UX compliant - not anxiety-inducing) */}
            {sender.unreadCount > 0 && (
              <span
                className="h-2 w-2 rounded-full bg-primary/60"
                aria-label={`${sender.unreadCount} unread from ${sender.displayName}`}
              />
            )}
            <span className="text-muted-foreground text-xs">
              {sender.userNewsletterCount}
            </span>
          </div>
        </button>
      ))}

      {/* Empty state when no senders */}
      {senderList.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No senders yet
        </p>
      )}
    </aside>
  )
}

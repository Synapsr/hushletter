import { useState, useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { NewsletterCard, type NewsletterData } from "~/components/NewsletterCard"
import { EmptyNewsletterState } from "~/components/EmptyNewsletterState"
import {
  SenderSidebar,
  SenderSidebarSkeleton,
  type SenderData,
} from "~/components/SenderSidebar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "~/components/ui/sheet"
import { Button } from "~/components/ui/button"
import { Menu } from "lucide-react"

/**
 * Search params schema for URL-based sender filtering
 * Task 4: URL format /newsletters?sender={senderId}
 */
type NewsletterSearchParams = {
  sender?: string
}

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
  validateSearch: (search: Record<string, unknown>): NewsletterSearchParams => ({
    sender: typeof search.sender === "string" ? search.sender : undefined,
  }),
})

// Type for getCurrentUser query response
type CurrentUserData = {
  id: string
  email: string
  name: string | null
  dedicatedEmail: string | null
} | null

/**
 * Skeleton loader for newsletter list
 */
function NewsletterListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse bg-card border rounded-xl p-4 space-y-2"
        >
          <div className="flex justify-between">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="h-5 bg-muted rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

/**
 * Full page skeleton while initial data loads
 */
function PageSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar skeleton */}
      <div className="hidden md:block">
        <SenderSidebarSkeleton />
      </div>
      {/* Main content skeleton */}
      <main className="flex-1 p-6">
        <div className="animate-pulse h-8 bg-muted rounded w-1/4 mb-6" />
        <NewsletterListSkeleton />
      </main>
    </div>
  )
}

function NewslettersPage() {
  // Task 4: URL-based filter state (AC2, AC3)
  const { sender: senderIdParam } = Route.useSearch()
  const navigate = useNavigate()

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get current user for dedicated email (used in empty state)
  const { data: userData, isPending: userPending } = useQuery(
    convexQuery(api.auth.getCurrentUser, {})
  )
  const user = userData as CurrentUserData

  // Get senders with unread counts for totals calculation
  const { data: sendersData, isPending: sendersPending } = useQuery(
    convexQuery(api.senders.listSendersForUserWithUnreadCounts, {})
  )
  const senders = (sendersData ?? []) as SenderData[]

  // Task 5: Get newsletters with optional sender filtering (AC2, AC3)
  // Uses convexQuery for automatic real-time updates
  // senderId from URL is a string - cast to Id<"senders"> for Convex type safety
  // Convex validates at runtime that the ID is valid
  const { data: newsletters, isPending: newslettersPending } = useQuery(
    convexQuery(api.newsletters.listUserNewslettersBySender, {
      senderId: senderIdParam as Id<"senders"> | undefined,
    })
  )

  // Calculate totals for "All Newsletters" display
  const { totalNewsletterCount, totalUnreadCount } = useMemo(() => {
    return senders.reduce(
      (acc, sender) => ({
        totalNewsletterCount: acc.totalNewsletterCount + sender.userNewsletterCount,
        totalUnreadCount: acc.totalUnreadCount + sender.unreadCount,
      }),
      { totalNewsletterCount: 0, totalUnreadCount: 0 }
    )
  }, [senders])

  // Get selected sender details for header
  const selectedSender = useMemo(() => {
    if (!senderIdParam) return null
    return senders.find((s) => s._id === senderIdParam) ?? null
  }, [senders, senderIdParam])

  // Task 4: Handle sender selection with URL update
  const handleSenderSelect = (selectedSenderId: string | null) => {
    navigate({
      to: "/newsletters",
      search: selectedSenderId ? { sender: selectedSenderId } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Show loading skeleton while initial data is loading
  if (userPending || sendersPending || newslettersPending) {
    return <PageSkeleton />
  }

  const dedicatedEmail = user?.dedicatedEmail ?? null
  const newsletterList = (newsletters ?? []) as NewsletterData[]

  // Sidebar props shared between desktop and mobile
  const sidebarProps = {
    selectedSenderId: senderIdParam ?? null,
    onSenderSelect: handleSenderSelect,
    totalNewsletterCount,
    totalUnreadCount,
  }

  return (
    <div className="flex min-h-screen">
      {/* Task 6: Desktop sidebar - fixed width (AC1) */}
      <div className="hidden md:block">
        <SenderSidebar {...sidebarProps} />
      </div>

      {/* Task 6: Mobile sidebar trigger + drawer
          NOTE: Position fixed at top-4 left-4 - ensure this doesn't overlap
          with any global header/nav in the _authed layout. Adjust if needed.
      */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open sender menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72" showCloseButton={false}>
            <SheetTitle className="sr-only">Sender Navigation</SheetTitle>
            <SenderSidebar {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Task 6: Main content area - flex grow */}
      <main className="flex-1 p-6 md:p-8">
        {/* Dynamic header based on filter (AC3) */}
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {selectedSender ? selectedSender.displayName : "All Newsletters"}
        </h1>

        {/* Empty state when no newsletters (AC5 from 2.4) */}
        {newsletterList.length === 0 ? (
          selectedSender ? (
            // Empty state for filtered view
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No newsletters from {selectedSender.displayName} yet.
              </p>
            </div>
          ) : (
            // Global empty state
            <EmptyNewsletterState dedicatedEmail={dedicatedEmail} />
          )
        ) : (
          /* Newsletter list - sorted by receivedAt descending (AC3) */
          <div className="space-y-3">
            {newsletterList.map((newsletter) => (
              <NewsletterCard key={newsletter._id} newsletter={newsletter} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

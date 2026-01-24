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
  type FolderData,
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
 * Search params schema for URL-based filtering
 * Story 3.1: Task 4 - URL format /newsletters?sender={senderId}
 * Story 3.3: Task 1.5, 2.2 - Added folder param
 * Story 3.5: Task 6, 7 - Added filter param for "hidden"
 */
type NewsletterSearchParams = {
  sender?: string
  folder?: string
  filter?: string  // Story 3.5: "hidden" filter
}

/**
 * Validate that a string looks like a valid Convex ID
 * Convex IDs are base64-like strings, typically alphanumeric with specific patterns
 * Code review fix (MEDIUM-2): Prevent invalid IDs from reaching queries
 */
function isValidConvexId(id: string | undefined): boolean {
  if (!id || typeof id !== "string") return false
  // Convex IDs are non-empty strings without special characters
  // Basic validation to filter out obvious garbage like "undefined", empty strings, etc.
  return id.length > 0 && id.trim() === id && !/\s/.test(id)
}

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
  validateSearch: (search: Record<string, unknown>): NewsletterSearchParams => {
    const sender = typeof search.sender === "string" ? search.sender : undefined
    const folder = typeof search.folder === "string" ? search.folder : undefined
    const filter = typeof search.filter === "string" ? search.filter : undefined

    return {
      // Code review fix (MEDIUM-2): Validate IDs before passing to queries
      sender: isValidConvexId(sender) ? sender : undefined,
      folder: folder === "uncategorized" || isValidConvexId(folder) ? folder : undefined,
      filter: filter === "hidden" ? filter : undefined, // Only allow known filter values
    }
  },
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
  // Story 3.3 Task 1.5, 2.2: URL-based filter state for both sender and folder
  // Story 3.5: Added filter param for "hidden"
  const { sender: senderIdParam, folder: folderIdParam, filter: filterParam } = Route.useSearch()
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

  // Get folders with unread counts
  // Story 3.3 Task 1.1
  const { data: foldersData, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listFoldersWithUnreadCounts, {})
  )
  const folders = (foldersData ?? []) as FolderData[]

  // Determine filter type - mutually exclusive
  const isFilteringByHidden = filterParam === "hidden"
  const isFilteringByFolder = !!folderIdParam && !senderIdParam && !isFilteringByHidden
  const isFilteringBySender = !isFilteringByFolder && !isFilteringByHidden

  // Story 3.3 Task 2.1: Get newsletters by folder OR by sender
  // Folder filter and sender filter are mutually exclusive
  const { data: newslettersBySender, isPending: newslettersBySenderPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersBySender, {
      senderId: senderIdParam as Id<"senders"> | undefined,
    }),
    enabled: isFilteringBySender, // Only run when filtering by sender (or no filter)
  })

  // Story 3.3 Task 2.1: Query for folder-filtered newsletters
  const { data: newslettersByFolder, isPending: newslettersByFolderPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersByFolder, {
      // "uncategorized" becomes null for uncategorized senders
      folderId: folderIdParam === "uncategorized" ? null : (folderIdParam as Id<"folders">),
    }),
    enabled: isFilteringByFolder, // Only run when filtering by folder
  })

  // Story 3.5: Always fetch hidden newsletters (used for count + conditionally for display)
  // Code review fix: consolidated from two separate queries to avoid redundant fetches
  const { data: hiddenNewsletters, isPending: hiddenNewslettersPending } = useQuery(
    convexQuery(api.newsletters.listHiddenNewsletters, {})
  )
  const hiddenCount = Array.isArray(hiddenNewsletters) ? hiddenNewsletters.length : 0

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

  // Get selected folder details for header
  // Story 3.3 Task 2.3
  const selectedFolder = useMemo(() => {
    if (!folderIdParam) return null
    if (folderIdParam === "uncategorized") {
      return { name: "Uncategorized", _id: "uncategorized" }
    }
    return folders.find((f) => f._id === folderIdParam) ?? null
  }, [folders, folderIdParam])

  // Story 3.3 Task 1.5: Handle sender selection with URL update
  const handleSenderSelect = (selectedSenderId: string | null) => {
    navigate({
      to: "/newsletters",
      search: selectedSenderId ? { sender: selectedSenderId } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Story 3.3 Task 1.5: Handle folder selection with URL update
  const handleFolderSelect = (selectedFolderId: string | null) => {
    navigate({
      to: "/newsletters",
      search: selectedFolderId ? { folder: selectedFolderId } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Story 3.5: Handle filter selection (e.g., "hidden")
  const handleFilterSelect = (filter: string | null) => {
    navigate({
      to: "/newsletters",
      search: filter ? { filter } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Show loading skeleton while initial data is loading
  const isPending = userPending || sendersPending || foldersPending ||
    (isFilteringByHidden
      ? hiddenNewslettersPending
      : isFilteringByFolder
        ? newslettersByFolderPending
        : newslettersBySenderPending)

  if (isPending) {
    return <PageSkeleton />
  }

  const dedicatedEmail = user?.dedicatedEmail ?? null

  // Select the appropriate newsletter list based on filter type
  const newsletterList = isFilteringByHidden
    ? (hiddenNewsletters ?? []) as NewsletterData[]
    : isFilteringByFolder
      ? (newslettersByFolder ?? []) as NewsletterData[]
      : (newslettersBySender ?? []) as NewsletterData[]

  // Sidebar props shared between desktop and mobile
  const sidebarProps = {
    selectedSenderId: senderIdParam ?? null,
    selectedFolderId: folderIdParam ?? null,
    selectedFilter: filterParam ?? null,  // Story 3.5
    onSenderSelect: handleSenderSelect,
    onFolderSelect: handleFolderSelect,
    onFilterSelect: handleFilterSelect,  // Story 3.5
    totalNewsletterCount,
    totalUnreadCount,
    hiddenCount,  // Story 3.5
  }

  // Determine header text based on current filter
  // Story 3.3 Task 2.3, Story 3.5 Task 7
  const headerText = isFilteringByHidden
    ? "Hidden Newsletters"
    : selectedSender
      ? selectedSender.displayName
      : selectedFolder
        ? selectedFolder.name
        : "All Newsletters"

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
        {/* Dynamic header based on filter (AC3) - Story 3.3 Task 2.3 */}
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {headerText}
        </h1>

        {/* Empty state when no newsletters (AC5 from 2.4) */}
        {newsletterList.length === 0 ? (
          isFilteringByHidden ? (
            // Story 3.5 Task 7.3: Empty state for hidden newsletters view (AC3)
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No hidden newsletters. Newsletters you hide will appear here.
              </p>
            </div>
          ) : selectedSender ? (
            // Empty state for sender-filtered view
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No newsletters from {selectedSender.displayName} yet.
              </p>
            </div>
          ) : selectedFolder ? (
            // Empty state for folder-filtered view - Story 3.3
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No newsletters in {selectedFolder.name}.
              </p>
            </div>
          ) : (
            // Global empty state
            <EmptyNewsletterState dedicatedEmail={dedicatedEmail} />
          )
        ) : (
          /* Newsletter list - sorted by receivedAt descending (AC3) */
          /* Story 3.5 Task 7.2: Show "Unhide" button for hidden newsletters (AC4) */
          <div className="space-y-3">
            {newsletterList.map((newsletter) => (
              <NewsletterCard
                key={newsletter._id}
                newsletter={newsletter}
                showUnhide={isFilteringByHidden}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

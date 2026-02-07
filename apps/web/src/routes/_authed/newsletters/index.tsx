import { useState, useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import { NewsletterCard, type NewsletterData } from "~/components/NewsletterCard"
import { EmptyNewsletterState } from "~/components/EmptyNewsletterState"
import {
  FolderSidebar,
  FolderSidebarSkeleton,
  type FolderData,
} from "~/components/FolderSidebar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "~/components/ui/sheet"
import { Button } from "~/components/ui/button"
import { Menu } from "lucide-react"

/**
 * Sender data returned by listSendersInFolder query
 * Story 9.4: AC5 - Show senders in folder header
 *
 * Note: This interface should match the return type of api.senders.listSendersInFolder.
 * Keep in sync with senders.ts.
 */
interface FolderSenderData {
  _id: string
  email: string
  name?: string
  displayName: string
  domain: string
}

/** Code review fix: Extract magic string to constant */
const FILTER_HIDDEN = "hidden" as const
type FilterType = typeof FILTER_HIDDEN

/**
 * Search params schema for URL-based filtering
 * Story 9.4: Folder-centric navigation - folder is now PRIMARY
 * Story 3.5: Task 6, 7 - Added filter param for "hidden"
 *
 * URL structure:
 * - /newsletters                    → All newsletters (from visible folders)
 * - /newsletters?folder={folderId}  → Folder view (PRIMARY)
 * - /newsletters?filter=hidden      → Hidden newsletters
 */
type NewsletterSearchParams = {
  folder?: string
  filter?: FilterType  // Story 3.5: "hidden" filter
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
    const folder = typeof search.folder === "string" ? search.folder : undefined
    const filter = typeof search.filter === "string" ? search.filter : undefined

    return {
      // Story 9.4: Folder is now primary navigation - validate ID
      folder: isValidConvexId(folder) ? folder : undefined,
      filter: filter === FILTER_HIDDEN ? FILTER_HIDDEN : undefined, // Only allow known filter values
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
      {/* Desktop sidebar skeleton - Story 9.4: Using FolderSidebarSkeleton */}
      <div className="hidden md:block">
        <FolderSidebarSkeleton />
      </div>
      {/* Main content skeleton */}
      <main className="flex-1 p-6">
        <div className="animate-pulse h-8 bg-muted rounded w-1/4 mb-6" />
        <NewsletterListSkeleton />
      </main>
    </div>
  )
}

/**
 * FolderHeader - Shows folder name and senders in folder
 * Story 9.4: AC4, AC5 - Folder detail view header
 * Code Review Fix MEDIUM-3: Uses consolidated getFolderWithSenders query (1 round-trip instead of 2)
 */
function FolderHeader({ folderId }: { folderId: string }) {
  // Get folder with senders in a single query (Code Review Fix MEDIUM-3)
  const { data: folderData } = useQuery(
    convexQuery(api.folders.getFolderWithSenders, { folderId: folderId as Id<"folders"> })
  )

  if (!folderData) return null

  const senderList = (folderData.senders ?? []) as FolderSenderData[]

  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-foreground">{folderData.name}</h1>
      {/* Story 9.4 AC5: Show which senders are in this folder */}
      {senderList.length > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          {senderList.length === 1
            ? `From ${senderList[0].displayName}`
            : `From ${senderList.map((s) => s.displayName).join(", ")}`}
        </p>
      )}
    </div>
  )
}

function NewslettersPage() {
  // Story 9.4: Folder-centric navigation - folder is PRIMARY
  // Story 3.5: Added filter param for "hidden"
  const { folder: folderIdParam, filter: filterParam } = Route.useSearch()
  const navigate = useNavigate()

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get current user for dedicated email (used in empty state)
  const { data: userData, isPending: userPending } = useQuery(
    convexQuery(api.auth.getCurrentUser, {})
  )
  const user = userData as CurrentUserData

  // Story 9.4: Get visible folders with unread counts
  const { data: foldersData, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {})
  )
  const folders = (foldersData ?? []) as FolderData[]

  // Determine filter type - mutually exclusive
  const isFilteringByHidden = filterParam === FILTER_HIDDEN
  const isFilteringByFolder = !!folderIdParam && !isFilteringByHidden

  // Story 9.4: Get newsletters by folder (now primary navigation)
  // When no folder is selected, show all newsletters
  const { data: newslettersByFolder, isPending: newslettersByFolderPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersByFolder, {
      folderId: folderIdParam as Id<"folders">,
    }),
    enabled: isFilteringByFolder,
  })

  // Story 9.4: Get all newsletters when no folder is selected (across all visible folders)
  const { data: allNewsletters, isPending: allNewslettersPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersBySender, {
      senderId: undefined, // All newsletters from all senders
    }),
    enabled: !isFilteringByFolder && !isFilteringByHidden,
  })

  // Story 3.5: Always fetch hidden newsletters (used for count + conditionally for display)
  const { data: hiddenNewsletters, isPending: hiddenNewslettersPending } = useQuery(
    convexQuery(api.newsletters.listHiddenNewsletters, {})
  )

  // Get selected folder details
  const selectedFolder = useMemo(() => {
    if (!folderIdParam) return null
    return folders.find((f) => f._id === folderIdParam) ?? null
  }, [folders, folderIdParam])

  // Story 9.4: Handle folder selection with URL update (PRIMARY navigation)
  const handleFolderSelect = (selectedFolderId: string | null) => {
    navigate({
      to: "/newsletters",
      search: selectedFolderId ? { folder: selectedFolderId } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Story 3.5: Handle filter selection (e.g., "hidden")
  const handleFilterSelect = (filter: FilterType | null) => {
    navigate({
      to: "/newsletters",
      search: filter ? { filter } : {},
    })
    // Close mobile sidebar on selection
    setSidebarOpen(false)
  }

  // Show loading skeleton while initial data is loading
  const isPending = userPending || foldersPending ||
    (isFilteringByHidden
      ? hiddenNewslettersPending
      : isFilteringByFolder
        ? newslettersByFolderPending
        : allNewslettersPending)

  if (isPending) {
    return <PageSkeleton />
  }

  const dedicatedEmail = user?.dedicatedEmail ?? null

  // Select the appropriate newsletter list based on filter type
  const newsletterList = isFilteringByHidden
    ? (hiddenNewsletters ?? []) as NewsletterData[]
    : isFilteringByFolder
      ? (newslettersByFolder ?? []) as NewsletterData[]
      : (allNewsletters ?? []) as NewsletterData[]

  // Story 9.4: FolderSidebar props - simplified from SenderSidebar
  const sidebarProps = {
    selectedFolderId: folderIdParam ?? null,
    selectedFilter: filterParam ?? null,
    onFolderSelect: handleFolderSelect,
    onFilterSelect: handleFilterSelect,
  }

  return (
    <div className="flex min-h-screen">
      {/* Story 9.4 Task 1: Desktop sidebar - FolderSidebar replaces SenderSidebar */}
      <div className="hidden md:block">
        <FolderSidebar {...sidebarProps} />
      </div>

      {/* Mobile sidebar trigger + drawer */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open folder menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72" showCloseButton={false}>
            <SheetTitle className="sr-only">Folder Navigation</SheetTitle>
            <FolderSidebar {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content area */}
      <main className="flex-1 p-6 md:p-8">
        {/* Story 9.4: Dynamic header based on folder selection */}
        {isFilteringByHidden ? (
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Hidden Newsletters
          </h1>
        ) : selectedFolder && folderIdParam ? (
          /* Story 9.4 AC4, AC5: Folder header with sender list */
          <FolderHeader folderId={folderIdParam} />
        ) : (
          <h1 className="text-3xl font-bold text-foreground mb-6">
            All Newsletters
          </h1>
        )}

        {/* Empty state when no newsletters */}
        {newsletterList.length === 0 ? (
          isFilteringByHidden ? (
            // Story 3.5: Empty state for hidden newsletters view
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No hidden newsletters. Newsletters you hide will appear here.
              </p>
            </div>
          ) : selectedFolder ? (
            // Story 9.4 Task 6.2: Empty state for folder-filtered view
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
          /* Story 9.4 AC4: Newsletter list - sorted by date (newest first) */
          /* Story 9.4 AC7: Each newsletter shows sender name via NewsletterCard */
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

import { useRef, useCallback, useMemo, useState, useDeferredValue } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useConvex } from "convex/react"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import {
  CommunityNewsletterCard,
  type CommunityNewsletterData,
} from "~/components/CommunityNewsletterCard"
import { SharingOnboardingModal } from "~/components/SharingOnboardingModal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Input } from "~/components/ui/input"
import { Card, CardContent } from "~/components/ui/card"
import { convexQuery } from "@convex-dev/react-query"
import { Loader2, Search, Users, ChevronRight } from "lucide-react"

/** Response type from listCommunityNewsletters query */
type CommunityNewslettersResponse = {
  items: CommunityNewsletterData[]
  nextCursor: Id<"newsletterContent"> | null
  cursorValue: number | null
  cursorId: Id<"newsletterContent"> | null
}

/** Response type from listCommunitySenders query */
type CommunitySenderData = {
  email: string
  name: string | undefined
  newsletterCount: number
  totalReaders: number
}

/** Response type from listTopCommunitySenders query - Story 6.3 */
type TopCommunitySenderData = {
  email: string
  name: string | undefined
  displayName: string
  domain: string
  subscriberCount: number
  newsletterCount: number
}

/**
 * Search params for community browse page
 * Story 6.1: Task 2.3-2.4
 * Story 6.3: Added tab for browse modes
 * Story 6.4: Added domain filter
 */
type CommunitySearchParams = {
  sort?: "popular" | "recent"
  sender?: string
  domain?: string  // Story 6.4: Domain filter
  tab?: "newsletters" | "senders"
}

export const Route = createFileRoute("/_authed/community/")({
  component: CommunityBrowsePage,
  validateSearch: (search: Record<string, unknown>): CommunitySearchParams => {
    const sort = search.sort === "recent" ? "recent" : undefined // Default is popular
    const sender = typeof search.sender === "string" ? search.sender : undefined
    const domain = typeof search.domain === "string" ? search.domain : undefined // Story 6.4
    const tab = search.tab === "senders" ? "senders" : undefined // Default is newsletters
    return { sort, sender, domain, tab }
  },
})

/**
 * Skeleton loader for community newsletter list
 */
function CommunityListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
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
 * Empty state when no community newsletters found
 */
function EmptyCommunityState({ senderFilter }: { senderFilter?: string }) {
  if (senderFilter) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No newsletters found from this sender in the community.
        </p>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <p className="text-xl font-medium mb-2">No community newsletters yet</p>
      <p className="text-muted-foreground">
        Newsletters shared by users will appear here. Subscribe to some
        newsletters to help build the community library!
      </p>
    </div>
  )
}

/**
 * Empty state when no search results found
 * Story 6.3: Task 1.5 - Friendly empty state for search queries
 */
function EmptySearchState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-12">
      <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <p className="text-lg font-medium mb-2">No results found</p>
      <p className="text-muted-foreground">
        No newsletters matching "{searchQuery}" were found.
        <br />
        Try different keywords or browse all newsletters.
      </p>
    </div>
  )
}

/**
 * Error state for community page
 * MEDIUM-5 fix: Add error handling
 */
function CommunityErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-lg font-medium mb-2 text-destructive">Something went wrong</p>
      <p className="text-muted-foreground mb-4">
        Failed to load community newsletters. Please try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/**
 * Sender card for "Browse by Sender" section
 * Story 6.3: Task 2.1
 */
function SenderCard({ sender }: { sender: TopCommunitySenderData }) {
  return (
    <Link
      to="/community/sender/$senderEmail"
      params={{ senderEmail: sender.email }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
    >
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-foreground truncate">
                {sender.displayName}
              </p>
              {sender.name && (
                <p className="text-sm text-muted-foreground truncate">
                  {sender.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{sender.subscriberCount} subscribers</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * CommunityBrowsePage - Browse public newsletter content
 * Story 6.1: Task 2.1-2.6
 * Story 6.3: Added search functionality and "Browse by Sender" tab
 *
 * Features:
 * - Search newsletters by subject and sender name (Story 6.3)
 * - Browse by sender section with top senders (Story 6.3)
 * - List newsletters from newsletterContent (public/shared content only)
 * - Sort by popular (readerCount) or recent (firstReceivedAt)
 * - Filter by sender
 * - Infinite scroll pagination using TanStack Query's useInfiniteQuery
 * - Reader count badges
 * - Navigate to community reader view
 *
 * Note: Uses useInfiniteQuery for proper infinite scroll state management,
 * which is the recommended pattern for paginated server data.
 * Uses useDeferredValue for search debouncing (per Story 6.2 pattern).
 */
function CommunityBrowsePage() {
  const { sort, sender, domain, tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const convex = useConvex()

  // Search state with useDeferredValue for debouncing (Story 6.3 Task 1.3)
  const [searchInput, setSearchInput] = useState("")
  const deferredSearchQuery = useDeferredValue(searchInput)
  const isSearching = searchInput !== deferredSearchQuery

  // Infinite scroll observer ref
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Use TanStack Query's useInfiniteQuery for proper pagination state management
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
  } = useInfiniteQuery({
    queryKey: ["community-newsletters", sort, sender, domain], // Story 6.4: Include domain in query key
    queryFn: async ({ pageParam }) => {
      const result = await convex.query(api.community.listCommunityNewsletters, {
        sortBy: sort || "popular",
        senderEmail: sender,
        domain, // Story 6.4: Domain filter
        cursorValue: pageParam?.cursorValue,
        cursorId: pageParam?.cursorId,
        limit: 20,
      })
      return result as CommunityNewslettersResponse
    },
    initialPageParam: undefined as { cursorValue: number; cursorId: Id<"newsletterContent"> } | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.cursorValue || !lastPage.cursorId) return undefined
      return { cursorValue: lastPage.cursorValue, cursorId: lastPage.cursorId }
    },
    enabled: !deferredSearchQuery && tab !== "senders", // Disable when searching or on senders tab
  })

  // Story 6.4 Task 3.1: Fetch distinct domains for filter dropdown
  const { data: domainsData } = useQuery(
    convexQuery(api.senders.listDistinctDomains, { limit: 50 })
  )
  const domains = (domainsData ?? []) as { domain: string; totalSubscribers: number }[]

  // Search query - Story 6.3 Task 1.2
  const { data: searchResults, isPending: isSearchPending, error: searchError, refetch: refetchSearch } = useQuery({
    ...convexQuery(api.community.searchCommunityNewsletters, {
      searchQuery: deferredSearchQuery,
      limit: 50,
    }),
    enabled: deferredSearchQuery.length > 0 && tab !== "senders",
  })

  // Check if search results may be incomplete (MEDIUM-6 fix)
  const searchResultsMayBeIncomplete = (searchResults as CommunityNewsletterData[] | undefined)?.length === 50

  // Top senders for "Browse by Sender" tab - Story 6.3 Task 2.2
  const { data: topSenders, isPending: isSendersPending, error: sendersError, refetch: refetchSenders } = useQuery({
    ...convexQuery(api.community.listTopCommunitySenders, { limit: 30 }),
    enabled: tab === "senders",
  })

  // Flatten paginated results
  const allNewsletters = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  // Fetch senders for filter dropdown
  const { data: sendersData } = useQuery(
    convexQuery(api.community.listCommunitySenders, { limit: 50 })
  )
  const senders = (sendersData ?? []) as CommunitySenderData[]

  // Determine which newsletters to display
  const displayNewsletters = deferredSearchQuery
    ? (searchResults as CommunityNewsletterData[] | undefined) ?? []
    : allNewsletters

  // Load more callback for infinite scroll
  const loadMore = useCallback(() => {
    if (!isFetching && hasNextPage && !deferredSearchQuery) {
      fetchNextPage()
    }
  }, [isFetching, hasNextPage, fetchNextPage, deferredSearchQuery])

  // Intersection observer for infinite scroll
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    },
    [loadMore]
  )

  // Set up intersection observer
  const setLoadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(observerCallback, {
          threshold: 0.1,
        })
        observer.observe(node)
        return () => observer.disconnect()
      }
    },
    [observerCallback]
  )

  // Handle sort change
  const handleSortChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: value === "popular" ? undefined : (value as "recent"),
      }),
    })
  }

  // Handle sender filter change
  const handleSenderChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sender: value === "all" ? undefined : value,
      }),
    })
  }

  // Story 6.4 Task 3.2: Handle domain filter change
  const handleDomainChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        domain: value === "all" ? undefined : value,
      }),
    })
  }

  // Handle tab change - Story 6.3 Task 2.1
  const handleTabChange = (newTab: "newsletters" | "senders") => {
    setSearchInput("") // Clear search when switching tabs
    navigate({
      search: (prev) => ({
        ...prev,
        tab: newTab === "newsletters" ? undefined : newTab,
      }),
    })
  }

  // Render newsletter list content
  const renderNewsletterList = () => {
    const isLoading = deferredSearchQuery ? isSearchPending || isSearching : isPending

    // Error handling (MEDIUM-5 fix)
    if (searchError && deferredSearchQuery) {
      return <CommunityErrorState onRetry={() => refetchSearch()} />
    }

    if (isLoading) {
      return <CommunityListSkeleton />
    }

    if (deferredSearchQuery && displayNewsletters.length === 0) {
      return <EmptySearchState searchQuery={deferredSearchQuery} />
    }

    if (displayNewsletters.length === 0) {
      return <EmptyCommunityState senderFilter={sender} />
    }

    return (
      <div className="space-y-3">
        {displayNewsletters.map((newsletter) => (
          <CommunityNewsletterCard key={newsletter._id} newsletter={newsletter} />
        ))}

        {/* Search results limit warning (MEDIUM-6 fix) */}
        {deferredSearchQuery && searchResultsMayBeIncomplete && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Showing top 50 results. Try more specific keywords for better matches.
            </p>
          </div>
        )}

        {/* Infinite scroll trigger - only when not searching */}
        {!deferredSearchQuery && (
          <div
            ref={(node) => {
              loadMoreRef.current = node
              setLoadMoreRef(node)
            }}
            className="h-20 flex items-center justify-center"
          >
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
            {!hasNextPage && displayNewsletters.length > 0 && (
              <p className="text-sm text-muted-foreground">
                You've reached the end
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render senders list content - Story 6.3 Task 2.1
  const renderSendersList = () => {
    // Error handling (MEDIUM-5 fix)
    if (sendersError) {
      return <CommunityErrorState onRetry={() => refetchSenders()} />
    }

    if (isSendersPending) {
      return <CommunityListSkeleton />
    }

    const sendersList = (topSenders ?? []) as TopCommunitySenderData[]

    if (sendersList.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-xl font-medium mb-2">No senders yet</p>
          <p className="text-muted-foreground">
            Senders will appear here as users share newsletters.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {sendersList.map((senderItem) => (
          <SenderCard key={senderItem.email} sender={senderItem} />
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Onboarding modal - shows once for new users */}
      <SharingOnboardingModal />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Community</h1>
        <p className="text-muted-foreground mt-1">
          Discover newsletters shared by the community
        </p>
      </div>

      {/* Tab navigation - Story 6.3 Task 2.1 (with accessibility attributes) */}
      <div role="tablist" aria-label="Community browse options" className="flex gap-2 mb-6 border-b">
        <button
          role="tab"
          aria-selected={tab !== "senders"}
          aria-controls="newsletters-panel"
          id="newsletters-tab"
          onClick={() => handleTabChange("newsletters")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab !== "senders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Newsletters
        </button>
        <button
          role="tab"
          aria-selected={tab === "senders"}
          aria-controls="senders-panel"
          id="senders-tab"
          onClick={() => handleTabChange("senders")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "senders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Browse by Sender
        </button>
      </div>

      {/* Newsletters tab content */}
      {tab !== "senders" && (
        <div role="tabpanel" id="newsletters-panel" aria-labelledby="newsletters-tab">
          {/* Search input - Story 6.3 Task 1.1 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search newsletters by subject or sender..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Controls: Sort + Sender filter + Domain filter - only show when not searching */}
          {!deferredSearchQuery && (
            <div className="flex flex-wrap gap-3 mb-6">
              {/* Sort control */}
              <Select value={sort || "popular"} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="recent">Recent</SelectItem>
                </SelectContent>
              </Select>

              {/* Sender filter */}
              <Select value={sender || "all"} onValueChange={handleSenderChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All senders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All senders</SelectItem>
                  {senders.map((s) => (
                    <SelectItem key={s.email} value={s.email}>
                      {s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Story 6.4 Task 3.2: Domain filter */}
              <Select value={domain || "all"} onValueChange={handleDomainChange}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by domain">
                  <SelectValue placeholder="All domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>
                      {d.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Newsletter list */}
          {renderNewsletterList()}
        </div>
      )}

      {/* Senders tab content - Story 6.3 Task 2.1 */}
      {tab === "senders" && (
        <div role="tabpanel" id="senders-panel" aria-labelledby="senders-tab">
          {renderSendersList()}
        </div>
      )}
    </div>
  )
}
